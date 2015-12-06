/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as path from 'path';

import {ISourceMaps, SourceMaps} from './sourceMaps';
import * as utils from '../../webkit/utilities';

interface IPendingBreakpoint {
    resolve: () => void;
    reject: (e: Error) => void;
    args: ISetBreakpointsArgs;
    requestSeq: number;
}

/**
 * If sourcemaps are enabled, converts from source files on the client side to runtime files on the target side
 */
export class SourceMapTransformer implements IDebugTransformer {
    private _sourceMaps: ISourceMaps;
    private _requestSeqToSetBreakpointsArgs: Map<number, ISetBreakpointsArgs>;
    private _allRuntimeScriptPaths: Set<string>;
    private _pendingBreakpointsByPath = new Map<string, IPendingBreakpoint>();
    private _webRoot: string;
    private _authoredPathsToMappedBPLines: Map<string, number[]>;
    private _authoredPathsToMappedBPCols: Map<string, number[]>;

    public launch(args: ILaunchRequestArgs): void {
        this.init(args);
    }

    public attach(args: IAttachRequestArgs): void {
        this.init(args);
    }

    private init(args: ILaunchRequestArgs | IAttachRequestArgs): void {
        if (args.sourceMaps) {
            this._webRoot = utils.getWebRoot(args);
            this._sourceMaps = new SourceMaps(this._webRoot);
            this._requestSeqToSetBreakpointsArgs = new Map<number, ISetBreakpointsArgs>();
            this._allRuntimeScriptPaths = new Set<string>();
            this._authoredPathsToMappedBPLines = new Map<string, number[]>();
            this._authoredPathsToMappedBPCols = new Map<string, number[]>();
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
            if (this._sourceMaps && args.source.path) {
                const argsPath = args.source.path;
                const mappedPath = this._sourceMaps.MapPathFromSource(argsPath);
                if (mappedPath) {
                    utils.Logger.log(`SourceMaps.setBP: Mapped ${argsPath} to ${mappedPath}`);
                    args.authoredPath = argsPath;
                    args.source.path = mappedPath;

                    // DebugProtocol doesn't send cols, but they need to be added from sourcemaps
                    const mappedCols = [];
                    const mappedLines = args.lines.map((line, i) => {
                        const mapped = this._sourceMaps.MapFromSource(argsPath, line, /*column=*/0);
                        if (mapped) {
                            utils.Logger.log(`SourceMaps.setBP: Mapped ${argsPath}:${line}:0 to ${mappedPath}:${mapped.line}:${mapped.column}`);
                            mappedCols[i] = mapped.column;
                            return mapped.line;
                        } else {
                            utils.Logger.log(`SourceMaps.setBP: Mapped ${argsPath} but not line ${line}, column 0`);
                            mappedCols[i] = 0;
                            return line;
                        }
                    });

                    this._authoredPathsToMappedBPLines.set(argsPath, mappedLines);
                    this._authoredPathsToMappedBPCols.set(argsPath, mappedCols);

                    // Include BPs from other files that map to the same file. Ensure the current file's breakpoints go first
                    args.lines = mappedLines;
                    args.cols = mappedCols;
                    this._sourceMaps.AllMappedSources(mappedPath).forEach(sourcePath => {
                        if (sourcePath === argsPath) {
                            return;
                        }

                        const sourceBPLines = this._authoredPathsToMappedBPLines.get(sourcePath);
                        const sourceBPCols = this._authoredPathsToMappedBPCols.get(sourcePath);

                        if (sourceBPLines && sourceBPCols) {
                            // Don't modify the cached array
                            args.lines = args.lines.concat(sourceBPLines);
                            args.cols = args.cols.concat(sourceBPCols);
                        }
                    });
                } else if (this._allRuntimeScriptPaths.has(argsPath)) {
                    // It's a generated file which is loaded
                    utils.Logger.log(`SourceMaps.setBP: SourceMaps are enabled but ${argsPath} is a runtime script`);
                } else {
                    // Source (or generated) file which is not loaded, need to wait
                    utils.Logger.log(`SourceMaps.setBP: ${argsPath} can't be resolved to a loaded script.`);
                    this._pendingBreakpointsByPath.set(argsPath, { resolve, reject, args, requestSeq });
                    return;
                }

                this._requestSeqToSetBreakpointsArgs.set(requestSeq, JSON.parse(JSON.stringify(args)));
                resolve();
            } else {
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
                const sourceBPLines = this._authoredPathsToMappedBPLines.get(args.authoredPath);
                if (sourceBPLines) {
                    // authoredPath is set, so the file was mapped to source.
                    // Remove breakpoints from files that map to the same file, and map back to source.
                    response.breakpoints = response.breakpoints.filter((_, i) => i < sourceBPLines.length);
                    response.breakpoints.forEach(bp => {
                        const mapped = this._sourceMaps.MapToSource(args.source.path, bp.line, bp.column);
                        if (mapped) {
                            utils.Logger.log(`SourceMaps.setBP: Mapped ${args.source.path}:${bp.line}:${bp.column} to ${mapped.path}:${mapped.line}`);
                            bp.line = mapped.line;
                        } else {
                            utils.Logger.log(`SourceMaps.setBP: Can't map ${args.source.path}:${bp.line}:${bp.column}, keeping the line number as-is.`);
                        }

                        this._requestSeqToSetBreakpointsArgs.delete(requestSeq);
                    });
                }
            }
        }

        // Cleanup column, which is passed in here in case it's needed for sourcemaps, but isn't actually
        // part of the DebugProtocol
        response.breakpoints.forEach(bp => {
            delete bp.column;
        });
    }

    /**
     * Apply sourcemapping to the stacktrace response
     */
    public stackTraceResponse(response: IStackTraceResponseBody): void {
        if (this._sourceMaps) {
            response.stackFrames.forEach(stackFrame => {
                const mapped = this._sourceMaps.MapToSource(stackFrame.source.path, stackFrame.line, stackFrame.column);
                if (mapped && utils.existsSync(mapped.path)) {
                    // Script was mapped to a valid path
                    stackFrame.source.path = utils.canonicalizeUrl(mapped.path);
                    stackFrame.source.sourceReference = 0;
                    stackFrame.source.name = path.basename(mapped.path);
                    stackFrame.line = mapped.line;
                    stackFrame.column = mapped.column;
                } else if (utils.existsSync(stackFrame.source.path)) {
                    // Script could not be mapped, but does exist on disk. Keep it and clear the sourceReference.
                    stackFrame.source.sourceReference = 0;
                } else {
                    // Script could not be mapped and doesn't exist on disk. Clear the path, use sourceReference.
                    stackFrame.source.path = undefined;
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

    public scriptParsed(event: DebugProtocol.Event): void {
        if (this._sourceMaps) {
            if (!event.body.sourceMapURL) {
                return;
            }

            this._sourceMaps.ProcessNewSourceMap(event.body.scriptUrl, event.body.sourceMapURL).then(() => {
                this._allRuntimeScriptPaths.add(event.body.scriptUrl);

                const sources = this._sourceMaps.AllMappedSources(event.body.scriptUrl);
                if (sources) {
                    utils.Logger.log(`SourceMaps.scriptParsed: ${event.body.scriptUrl} was just loaded and has mapped sources: ${JSON.stringify(sources) }`);
                    sources.forEach(sourcePath => {
                        // If there's a setBreakpoints request waiting on this script, go through setBreakpoints again
                        if (this._pendingBreakpointsByPath.has(sourcePath)) {
                            utils.Logger.log(`SourceMaps.scriptParsed: Resolving pending breakpoints for ${sourcePath}`);
                            const pendingBreakpoint = this._pendingBreakpointsByPath.get(sourcePath);
                            this._pendingBreakpointsByPath.delete(sourcePath);

                            this.setBreakpoints(pendingBreakpoint.args, pendingBreakpoint.requestSeq)
                                .then(pendingBreakpoint.resolve, pendingBreakpoint.reject);
                        }
                    });
                }
            });
        }
    }
}
