/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as path from 'path';
import {DebugProtocol} from 'vscode-debugprotocol';
import {Handles} from 'vscode-debugadapter';

import {ISetBreakpointsArgs, ILaunchRequestArgs, IAttachRequestArgs,
    ISetBreakpointsResponseBody, IStackTraceResponseBody} from '../debugAdapterInterfaces';
import {SourceMaps} from '../sourceMaps/sourceMaps';
import * as utils from '../utils';
import * as logger from '../logger';
import {ISourceContainer} from '../chrome/chromeDebugAdapter';

interface IPendingBreakpoint {
    resolve: () => void;
    reject: (e: Error) => void;
    args: ISetBreakpointsArgs;
    requestSeq: number;
}

/**
 * If sourcemaps are enabled, converts from source files on the client side to runtime files on the target side
 */
export class BaseSourceMapTransformer {
    protected _sourceMaps: SourceMaps;
    protected _sourceHandles: Handles<ISourceContainer>;

    private _requestSeqToSetBreakpointsArgs: Map<number, ISetBreakpointsArgs>;
    private _allRuntimeScriptPaths: Set<string>;
    private _pendingBreakpointsByPath = new Map<string, IPendingBreakpoint>();
    private _authoredPathsToMappedBPs: Map<string, DebugProtocol.SourceBreakpoint[]>;

    constructor(sourceHandles: Handles<ISourceContainer>) {
        this._sourceHandles = sourceHandles;
    }

    public launch(args: ILaunchRequestArgs): void {
        this.init(args);
    }

    public attach(args: IAttachRequestArgs): void {
        this.init(args);
    }

    protected init(args: ILaunchRequestArgs | IAttachRequestArgs): void {
        if (args.sourceMaps) {
            this._sourceMaps = new SourceMaps(args.webRoot, args.sourceMapPathOverrides);
            this._requestSeqToSetBreakpointsArgs = new Map<number, ISetBreakpointsArgs>();
            this._allRuntimeScriptPaths = new Set<string>();
            this._authoredPathsToMappedBPs = new Map<string, DebugProtocol.SourceBreakpoint[]>();
        }
    }

    public clearTargetContext(): void {
        this._allRuntimeScriptPaths = new Set<string>();
    }

    /**
     * Apply sourcemapping to the setBreakpoints request path/lines
     */
    public setBreakpoints(args: ISetBreakpointsArgs, requestSeq: number): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (!this._sourceMaps) {
                resolve();
                return;
            }

            if (args.source.sourceReference) {
                // If the source contents were inlined, then args.source has no path, but we
                // stored it in the handle
                const handle = this._sourceHandles.get(args.source.sourceReference);
                if (handle.mappedPath) {
                    args.source.path = handle.mappedPath;
                }
            }

            if (args.source.path) {
                const argsPath = args.source.path;
                const mappedPath = this._sourceMaps.getGeneratedPathFromAuthoredPath(argsPath);
                if (mappedPath) {
                    logger.log(`SourceMaps.setBP: Mapped ${argsPath} to ${mappedPath}`);
                    args.authoredPath = argsPath;
                    args.source.path = mappedPath;

                    // DebugProtocol doesn't send cols yet, but they need to be added from sourcemaps
                    args.breakpoints.forEach(bp => {
                        const { line, column = 0 } = bp;
                        const mapped = this._sourceMaps.mapToGenerated(argsPath, line, column);
                        if (mapped) {
                            logger.log(`SourceMaps.setBP: Mapped ${argsPath}:${line + 1}:${column + 1} to ${mappedPath}:${mapped.line + 1}:${mapped.column + 1}`);
                            bp.line = mapped.line;
                            bp.column = mapped.column;
                        } else {
                            logger.log(`SourceMaps.setBP: Mapped ${argsPath} but not line ${line + 1}, column 1`);
                            bp.column = column; // take 0 default if needed
                        }
                    });

                    this._authoredPathsToMappedBPs.set(argsPath, args.breakpoints);

                    // Include BPs from other files that map to the same file. Ensure the current file's breakpoints go first
                    this._sourceMaps.allMappedSources(mappedPath).forEach(sourcePath => {
                        if (sourcePath === argsPath) {
                            return;
                        }

                        const sourceBPs = this._authoredPathsToMappedBPs.get(sourcePath);
                        if (sourceBPs) {
                            // Don't modify the cached array
                            args.breakpoints = args.breakpoints.concat(sourceBPs);
                        }
                    });
                } else if (this._allRuntimeScriptPaths.has(argsPath)) {
                    // It's a generated file which is loaded
                    logger.log(`SourceMaps.setBP: SourceMaps are enabled but ${argsPath} is a runtime script`);
                } else {
                    // Source (or generated) file which is not loaded, need to wait
                    logger.log(`SourceMaps.setBP: ${argsPath} can't be resolved to a loaded script. It may just not be loaded yet.`);
                    this._pendingBreakpointsByPath.set(argsPath, { resolve, reject, args, requestSeq });
                    return;
                }

                this._requestSeqToSetBreakpointsArgs.set(requestSeq, JSON.parse(JSON.stringify(args)));
                resolve();
            } else {
                // No source.path
                resolve();
            }
        });
    }

    /**
     * Apply sourcemapping back to authored files from the response
     */
    public setBreakpointsResponse(response: ISetBreakpointsResponseBody, requestSeq: number): void {
        if (this._sourceMaps && this._requestSeqToSetBreakpointsArgs.has(requestSeq)) {
            const args = this._requestSeqToSetBreakpointsArgs.get(requestSeq);
            if (args.authoredPath) {
                const sourceBPs = this._authoredPathsToMappedBPs.get(args.authoredPath);
                if (sourceBPs) {
                    // authoredPath is set, so the file was mapped to source.
                    // Remove breakpoints from files that map to the same file, and map back to source.
                    response.breakpoints = response.breakpoints.filter((_, i) => i < sourceBPs.length);
                    response.breakpoints.forEach(bp => {
                        const mapped = this._sourceMaps.mapToAuthored(args.source.path, bp.line, bp.column);
                        if (mapped) {
                            logger.log(`SourceMaps.setBP: Mapped ${args.source.path}:${bp.line + 1}:${bp.column + 1} to ${mapped.source}:${mapped.line + 1}`);
                            bp.line = mapped.line;
                            bp.column = mapped.column;
                        } else {
                            logger.log(`SourceMaps.setBP: Can't map ${args.source.path}:${bp.line + 1}:${bp.column + 1}, keeping the line number as-is.`);
                        }

                        this._requestSeqToSetBreakpointsArgs.delete(requestSeq);
                    });
                }
            }
        }
    }

    /**
     * Apply sourcemapping to the stacktrace response
     */
    public stackTraceResponse(response: IStackTraceResponseBody): void {
        if (this._sourceMaps) {
            response.stackFrames.forEach(stackFrame => {
                const mapped = this._sourceMaps.mapToAuthored(stackFrame.source.path, stackFrame.line, stackFrame.column);
                if (mapped && utils.existsSync(mapped.source)) {
                    // Script was mapped to a valid path
                    stackFrame.source.path = mapped.source;
                    stackFrame.source.sourceReference = 0;
                    stackFrame.source.name = path.basename(mapped.source);
                    stackFrame.line = mapped.line;
                    stackFrame.column = mapped.column;
                } else {
                    const inlinedSource = mapped && this._sourceMaps.sourceContentFor(mapped.source);
                    if (mapped && inlinedSource) {
                        // Clear the path and set the sourceReference - the client will ask for
                        // the source later and it will be returned from the sourcemap
                        stackFrame.source.path = undefined;
                        stackFrame.source.name = path.basename(mapped.source);
                        stackFrame.source.sourceReference = this._sourceHandles.create({ contents: inlinedSource, mappedPath: mapped.source });
                        stackFrame.line = mapped.line;
                        stackFrame.column = mapped.column;
                    } else if (utils.existsSync(stackFrame.source.path)) {
                        // Script could not be mapped, but does exist on disk. Keep it and clear the sourceReference.
                        stackFrame.source.sourceReference = 0;
                    } else {
                        // Script could not be mapped and doesn't exist on disk. Clear the path, use sourceReference.
                        stackFrame.source.name = 'eval: ' + stackFrame.source.sourceReference;
                        stackFrame.source.path = undefined;
                    }
                }
            });
        } else {
            response.stackFrames.forEach(stackFrame => {
                // PathTransformer needs to leave the frame in an unfinished state because it doesn't know whether sourcemaps are enabled
                if (stackFrame.source.path && stackFrame.source.sourceReference) {
                    stackFrame.source.path = undefined;
                }
            });
        }
    }

    public scriptParsed(pathToGenerated: string, sourceMapURL: string): void {
        if (this._sourceMaps) {
            this._allRuntimeScriptPaths.add(pathToGenerated);

            if (!sourceMapURL) {
                // If a file does not have a source map, check if we've seen any breakpoints
                // for it anyway and make sure to enable them
                this.resolvePendingBreakpointsForScript(pathToGenerated);
                return;
            }

            this._sourceMaps.processNewSourceMap(pathToGenerated, sourceMapURL).then(() => {
                const sources = this._sourceMaps.allMappedSources(pathToGenerated);
                if (sources) {
                    logger.log(`SourceMaps.scriptParsed: ${pathToGenerated} was just loaded and has mapped sources: ${JSON.stringify(sources) }`);
                    sources.forEach(sourcePath => {
                        this.resolvePendingBreakpointsForScript(sourcePath);
                    });
                }
            });
        }
    }

    public breakpointResolved(bp: DebugProtocol.Breakpoint, scriptPath: string): void {
        if (this._sourceMaps) {
            const mapped = this._sourceMaps.mapToAuthored(scriptPath, bp.line, bp.column);
            if (mapped) {
                // Not sending back the path here, since the bp has an ID
                bp.line = mapped.line;
                bp.column = mapped.column;
            }
        }
    }

    /**
     * Resolve any pending breakpoints for this script
     */
    private resolvePendingBreakpointsForScript(scriptUrl: string): void {
        if (this._pendingBreakpointsByPath.has(scriptUrl)) {
            logger.log(`SourceMaps.scriptParsed: Resolving pending breakpoints for ${scriptUrl}`);

            let pendingBreakpoints = this._pendingBreakpointsByPath.get(scriptUrl);
            this._pendingBreakpointsByPath.delete(scriptUrl);

            // If there's a setBreakpoints request waiting on this script, go through setBreakpoints again
            this.setBreakpoints(pendingBreakpoints.args, pendingBreakpoints.requestSeq)
                .then(pendingBreakpoints.resolve, pendingBreakpoints.reject);
        }
    }
}
