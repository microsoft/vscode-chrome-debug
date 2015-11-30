/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as utils from '../webkit/utilities';

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
            if (!args.source.path) {
                resolve();
                return;
            }

            if (utils.isURL(args.source.path)) {
                // already a url, use as-is
                utils.Logger.log(`Paths.setBP: ${args.source.path} is already a URL`);
                resolve();
                return;
            }

            const url = utils.canonicalizeUrl(args.source.path);
            if (this._clientPathToWebkitUrl.has(url)) {
                args.source.path = this._clientPathToWebkitUrl.get(url);
                utils.Logger.log(`Paths.setBP: Resolved ${url} to ${args.source.path}`);
                resolve();
            } else {
                utils.Logger.log(`Paths.setBP: No target url cached for client path: ${url}, waiting for target script to be loaded.`);
                args.source.path = url;
                this._pendingBreakpointsByPath.set(args.source.path, { resolve, reject, args });
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

        if (!clientPath) {
            utils.Logger.log(`Paths.scriptParsed: could not resolve ${webkitUrl} to a file in the workspace. webRoot: ${this._webRoot}`);
        } else {
            utils.Logger.log(`Paths.scriptParsed: resolved ${webkitUrl} to ${clientPath}. webRoot: ${this._webRoot}`);
            this._clientPathToWebkitUrl.set(clientPath, webkitUrl);
            this._webkitUrlToClientPath.set(webkitUrl, clientPath);

            event.body.scriptUrl = clientPath;
        }

        if (this._pendingBreakpointsByPath.has(event.body.scriptUrl)) {
            utils.Logger.log(`Paths.scriptParsed: Resolving pending breakpoints for ${event.body.scriptUrl}`);
            const pendingBreakpoint = this._pendingBreakpointsByPath.get(event.body.scriptUrl);
            this._pendingBreakpointsByPath.delete(event.body.scriptUrl);
            this.setBreakpoints(pendingBreakpoint.args).then(pendingBreakpoint.resolve, pendingBreakpoint.reject);
        }
    }

    public stackTraceResponse(response: IStackTraceResponseBody): void {
        response.stackFrames.forEach(frame => {
            if (frame.source.path) {
                // Try to resolve the url to a path in the workspace. If it's not in the workspace,
                // just use the script.url as-is. It will be resolved or cleared by the SourceMapTransformer.
                const clientPath = this._webkitUrlToClientPath.has(frame.source.path) ?
                    this._webkitUrlToClientPath.get(frame.source.path) :
                    utils.webkitUrlToClientPath(this._webRoot, frame.source.path);

                // Incoming stackFrames have sourceReference and path set. If the path was resolved to a file in the workspace,
                // clear the sourceReference since it's not needed.
                if (clientPath) {
                    frame.source.path = clientPath;
                    frame.source.sourceReference = 0;
                }
            }
        });
    }
}
