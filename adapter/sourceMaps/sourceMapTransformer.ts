/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {ISourceMaps, SourceMaps} from './sourceMaps';

/**
 * If sourcemaps are enabled, converts from source files on the client side to runtime files on the target side
 */
export class SourceMapTransformer implements IDebugTransformer {
    private _sourceMaps: ISourceMaps;
    private _generatedCodeDirectory: string;
    private _requestSeqToSetBreakpointsArgs: Map<number, DebugProtocol.SetBreakpointsArguments>;

    public launch(args: ILaunchRequestArgs): void {
        if (args.sourceMaps) {
            this._sourceMaps = new SourceMaps(args.outDir);
            this._generatedCodeDirectory = args.outDir;
            this._requestSeqToSetBreakpointsArgs = new Map<number, DebugProtocol.SetBreakpointsArguments>();
        }
    }

    /**
     * Apply sourcemapping to the setBreakpoints request path/lines
     */
    public setBreakpoints(args: ISetBreakpointsArgs, requestSeq: number): void {
        if (this._sourceMaps && args.source.path) {
            const argsPath = args.source.path;

            const mappedPath = this._sourceMaps.MapPathFromSource(argsPath);
            if (mappedPath) {
                args.source.path = mappedPath;

                // DebugProtocol doesn't send cols, but they need to be added from sourcemaps
                args.cols = [];
                args.lines = args.lines.map((line, i) => {
                    const mapped = this._sourceMaps.MapFromSource(argsPath, line, /*column=*/0);
                    if (mapped) {
                        args.cols[i] = mapped.column;
                        return mapped.line;
                    } else {
                        return line;
                    }
                });
            }

            this._requestSeqToSetBreakpointsArgs.set(requestSeq, JSON.parse(JSON.stringify(args)));
        }
    }

    /**
     * Apply sourcemapping back to authored files from the response
     */
    public setBreakpointsResponse(response: SetBreakpointsResponseBody, requestSeq: number): void {
        if (this._sourceMaps && this._requestSeqToSetBreakpointsArgs.has(requestSeq)) {
            const args = this._requestSeqToSetBreakpointsArgs.get(requestSeq);
            response.breakpoints.forEach(bp => {
                const mapped = this._sourceMaps.MapToSource(args.source.path, bp.line, (<any>bp).column);
                delete (<any>bp).column;
                if (mapped) {
                    bp.line = mapped.line;
                }

                this._requestSeqToSetBreakpointsArgs.delete(requestSeq);
            });
        } else {
            // Cleanup column, which is passed in here in case it's needed for sourcemaps, but isn't actually
            // part of the DebugProtocol
            response.breakpoints.forEach(bp => {
                delete (<any>bp).column;
            });
        }
    }

    /**
     * Apply sourcemapping to the stacktrace response
     */
    public stackTraceResponse(response: StackTraceResponseBody): void {
        if (this._sourceMaps) {
            response.stackFrames.forEach(stackFrame => {
                const mapped = this._sourceMaps.MapToSource(stackFrame.source.path, stackFrame.line, stackFrame.column);
                if (mapped) {
                    stackFrame.source.path = mapped.path;
                    stackFrame.line = mapped.line;
                    stackFrame.column = mapped.column;
                }
            });
        }
    }

    public scriptParsed(event: DebugProtocol.Event): void {
        if (this._sourceMaps) {
            // Send a dummy request just to get this file into the cache. SourceMaps can't trace a source file to a generated file
            // unless its already in its cache, without falling back on heuristics which may be wrong.
            this._sourceMaps.MapToSource(event.body.scriptUrl, 0, 0);
        }
    }
}
