/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

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
    private _requestSeqToSetBreakpointsArgs: Map<number, DebugProtocol.SetBreakpointsArguments>;
    private _allRuntimeScriptPaths: Set<string>;
    private _pendingBreakpointsByPath = new Map<string, IPendingBreakpoint>();

    public launch(args: ILaunchRequestArgs): void {
        this.init(args);
    }

    public attach(args: IAttachRequestArgs): void {
        this.init(args);
    }

    private init(args: ILaunchRequestArgs | IAttachRequestArgs): void {
        if (args.sourceMaps) {
            this._sourceMaps = new SourceMaps();
            this._requestSeqToSetBreakpointsArgs = new Map<number, DebugProtocol.SetBreakpointsArguments>();
            this._allRuntimeScriptPaths = new Set<string>();
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
                const mappedPath = this._sourceMaps.MapPathFromSource(args.source.path);
                if (mappedPath) {
                    utils.Logger.log(`SourceMaps.setBreakpoints: Mapped ${args.source.path} to ${mappedPath}`);
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
                } else if (this._allRuntimeScriptPaths.has(argsPath)) {
                    // It's a generated file which is loaded
                    utils.Logger.log(`SourceMaps.setBreakpoints: SourceMaps are enabled but ${argsPath} is a runtime script`);
                } else {
                    // Source (or generated) file which is not loaded, need to wait
                    utils.Logger.log(`SourceMaps.setBreakpoints: ${argsPath} can't be resolved to a loaded script.`);
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
            this._allRuntimeScriptPaths.add(event.body.scriptUrl);

            const mapped = this._sourceMaps.MapToSource(event.body.scriptUrl, 0, 0);
            if (mapped) {
                event.body.scriptUrl = mapped.path;
            }

            // If there's a setBreakpoints request waiting on this script, go through setBreakpoints again
            if (this._pendingBreakpointsByPath.has(event.body.scriptUrl)) {
                utils.Logger.log(`SourceMaps.scriptParsed: ${event.body.scriptUrl} was just loaded and has pending breakpoints`);
                const pendingBreakpoint = this._pendingBreakpointsByPath.get(event.body.scriptUrl);
                this._pendingBreakpointsByPath.delete(event.body.scriptUrl);

                this.setBreakpoints(pendingBreakpoint.args, pendingBreakpoint.requestSeq)
                    .then(pendingBreakpoint.resolve, pendingBreakpoint.reject);
            }
        }
    }
}
