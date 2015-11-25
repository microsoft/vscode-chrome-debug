/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as utils from '../webkit/utilities';
import * as path from 'path';

interface IPendingBreakpoint {
    resolve: () => void;
    reject: (e: Error) => void;
    args: ISetBreakpointsArgs;
}

/**
 * Converts a local path from Code to a path on the target.
 */
export class PathTransformer implements IDebugTransformer {
    private _webRoot: string;
    private _clientPathToWebkitUrl = new Map<string, string>();
    private _webkitUrlToClientPath = new Map<string, string>();
    private _pendingBreakpointsByPath = new Map<string, IPendingBreakpoint>();

    public launch(args: ILaunchRequestArgs): void {
        this._webRoot = utils.getWebRoot(args);
    }

    public attach(args: IAttachRequestArgs): void {
        this._webRoot = utils.getWebRoot(args);
    }


    public setBreakpoints(args: ISetBreakpointsArgs): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (args.source.path) {
                const url = utils.canonicalizeUrl(args.source.path);
                if (this._clientPathToWebkitUrl.has(url)) {
                    args.source.path = this._clientPathToWebkitUrl.get(url);
                    resolve();
                } else {
                    utils.Logger.log(`No target url cached for client url: ${url}, waiting for target script to be loaded.`);
                    args.source.path = url;
                    this._pendingBreakpointsByPath.set(args.source.path, { resolve, reject, args });
                }
            } else {
                resolve();
            }
        });
    }

    public clearClientContext(): void {
        this._pendingBreakpointsByPath = new Map<string, IPendingBreakpoint>();
    }

    public clearTargetContext(): void {
        this._clientPathToWebkitUrl = new Map<string, string>();
        this._webkitUrlToClientPath = new Map<string, string>();
    }

    public scriptParsed(event: DebugProtocol.Event): void {
        const webkitUrl: string = event.body.scriptUrl;
        const clientPath = utils.webkitUrlToClientPath(this._webRoot, webkitUrl);
        this._clientPathToWebkitUrl.set(clientPath, webkitUrl);
        this._webkitUrlToClientPath.set(webkitUrl, clientPath);
        event.body.scriptUrl = clientPath;

        if (this._pendingBreakpointsByPath.has(clientPath)) {
            const pendingBreakpoint = this._pendingBreakpointsByPath.get(clientPath);
            this._pendingBreakpointsByPath.delete(clientPath);
            this.setBreakpoints(pendingBreakpoint.args).then(pendingBreakpoint.resolve, pendingBreakpoint.reject);
        }
    }

    public stackTraceResponse(response: StackTraceResponseBody): void {
        response.stackFrames.forEach(frame => {
            // Try to resolve the url to a path in the workspace. If it's not in the workspace,
            // just use the script.url as-is.
            if (frame.source.path) {
                const clientPath = this._webkitUrlToClientPath.has(frame.source.path) ?
                    this._webkitUrlToClientPath.get(frame.source.path) :
                    utils.webkitUrlToClientPath(this._webRoot, frame.source.path);

                if (clientPath) {
                    frame.source.path = clientPath;
                }
            }
        });
    }
}
