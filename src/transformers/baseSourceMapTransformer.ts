/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as path from 'path';
import {DebugProtocol} from 'vscode-debugprotocol';
import {Handles} from 'vscode-debugadapter';

import {ISetBreakpointsArgs, ILaunchRequestArgs, IAttachRequestArgs,
    ISetBreakpointsResponseBody, IStackTraceResponseBody, ISourceMapPathOverrides} from '../debugAdapterInterfaces';
import {SourceMaps} from '../sourceMaps/sourceMaps';
import * as utils from '../utils';
import * as logger from '../logger';
import {ISourceContainer} from '../chrome/chromeDebugAdapter';

// Can be applied, or not, by consumers
export const DefaultWebsourceMapPathOverrides: ISourceMapPathOverrides = {
    'webpack:///*': '${webRoot}/*',
    'meteor://💻app/*': '${webRoot}/*'
};

/**
 * If sourcemaps are enabled, converts from source files on the client side to runtime files on the target side
 */
export class BaseSourceMapTransformer {
    protected _sourceMaps: SourceMaps;
    protected _sourceHandles: Handles<ISourceContainer>;

    private _requestSeqToSetBreakpointsArgs: Map<number, ISetBreakpointsArgs>;
    private _allRuntimeScriptPaths: Set<string>;
    private _authoredPathsToMappedBPLines: Map<string, number[]>;
    private _authoredPathsToMappedBPCols: Map<string, number[]>;

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
            this._sourceMaps = new SourceMaps(args.webRoot, args.sourceMapPathOverrides || DefaultWebsourceMapPathOverrides);
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
     * Apply sourcemapping to the setBreakpoints request path/lines.
     * Returns true if completed successfully, and setBreakpoint should continue.
     */
    public setBreakpoints(args: ISetBreakpointsArgs, requestSeq: number): boolean {
        if (!this._sourceMaps) {
            return true;
        }

        this._requestSeqToSetBreakpointsArgs.set(requestSeq, JSON.parse(JSON.stringify(args)));

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

                // DebugProtocol doesn't send cols, but they need to be added from sourcemaps
                const mappedCols = [];
                const mappedLines = args.lines.map((line, i) => {
                    const mapped = this._sourceMaps.mapToGenerated(argsPath, line, /*column=*/0);
                    if (mapped) {
                        logger.log(`SourceMaps.setBP: Mapped ${argsPath}:${line + 1}:1 to ${mappedPath}:${mapped.line + 1}:${mapped.column + 1}`);
                        mappedCols[i] = mapped.column;
                        return mapped.line;
                    } else {
                        logger.log(`SourceMaps.setBP: Mapped ${argsPath} but not line ${line + 1}, column 1`);
                        mappedCols[i] = 0;
                        return line;
                    }
                });

                this._authoredPathsToMappedBPLines.set(argsPath, mappedLines);
                this._authoredPathsToMappedBPCols.set(argsPath, mappedCols);

                // Include BPs from other files that map to the same file. Ensure the current file's breakpoints go first
                args.lines = mappedLines;
                args.cols = mappedCols;
                this._sourceMaps.allMappedSources(mappedPath).forEach(sourcePath => {
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
                logger.log(`SourceMaps.setBP: SourceMaps are enabled but ${argsPath} is a runtime script`);
            } else {
                // Source (or generated) file which is not loaded
                logger.log(`SourceMaps.setBP: ${argsPath} can't be resolved to a loaded script. It may just not be loaded yet.`);
                return false;
            }
        } else {
            // No source.path
        }

        return true;
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
                        const mapped = this._sourceMaps.mapToAuthored(args.source.path, bp.line, bp.column);
                        if (mapped) {
                            logger.log(`SourceMaps.setBP: Mapped ${args.source.path}:${bp.line + 1}:${bp.column + 1} to ${mapped.source}:${mapped.line + 1}`);
                            bp.line = mapped.line;
                        } else {
                            logger.log(`SourceMaps.setBP: Can't map ${args.source.path}:${bp.line + 1}:${bp.column + 1}, keeping the line number as-is.`);
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

            // Load the sourcemap for this new script and log its sources
            this._sourceMaps.processNewSourceMap(pathToGenerated, sourceMapURL).then(() => {
                const sources = this._sourceMaps.allMappedSources(pathToGenerated);
                if (sources) {
                    logger.log(`SourceMaps.scriptParsed: ${pathToGenerated} was just loaded and has mapped sources: ${JSON.stringify(sources) }`);
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
}
