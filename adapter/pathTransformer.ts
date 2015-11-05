/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as utils from '../webkit/utilities';

interface IPendingBreakpoint {
    resolve: () => void;
    args: ISetBreakpointsArgs;
}

/**
 * Converts a local path from Code to a path on the target.
 */
export class PathTransformer implements IDebugTransformer {
    private _clientCWD: string;
    private _clientUrlToWebkitUrl = new Map<string, string>();
    private _pendingBreakpointsByUrl = new Map<string, IPendingBreakpoint>();

    public launch(args: ILaunchRequestArgs): void {
        this._clientCWD = args.cwd;
    }

    public attach(args: IAttachRequestArgs): void {
        this._clientCWD = args.cwd;
    }

    public setBreakpoints(args: ISetBreakpointsArgs): Promise<void> {
        return new Promise<void>(resolve => {
            if (args.source.path) {
                const url = utils.canonicalizeUrl(args.source.path);
                if (this._clientUrlToWebkitUrl.has(url)) {
                    args.source.path = this._clientUrlToWebkitUrl.get(url);
                    resolve();
                } else {
                    utils.Logger.log(`No target url cached for client url: ${url}, waiting for target script to be loaded.`);
                    args.source.path = url;
                    this._pendingBreakpointsByUrl.set(args.source.path, { resolve, args });
                }
            }
        });
    }

    public clearClientContext(): void {
        this._pendingBreakpointsByUrl = new Map<string, IPendingBreakpoint>();
    }

    public clearTargetContext(): void {
        this._clientUrlToWebkitUrl = new Map<string, string>();
    }

    public scriptParsed(event: DebugProtocol.Event): void {
        // maybe cache canonicalized form? what about scripts with query args
        const webkitUrl: string = event.body.scriptUrl;
        const clientUrl = utils.webkitUrlToClientUrl(this._clientCWD, webkitUrl);
        this._clientUrlToWebkitUrl.set(clientUrl, webkitUrl);
        event.body.scriptUrl = clientUrl;

        if (this._pendingBreakpointsByUrl.has(clientUrl)) {
            const pendingBreakpoint = this._pendingBreakpointsByUrl.get(clientUrl);
            this._pendingBreakpointsByUrl.delete(clientUrl);
            this.setBreakpoints(pendingBreakpoint.args).then(pendingBreakpoint.resolve);
        }
    }

    public stackTraceResponse(response: StackTraceResponseBody): void {
        response.stackFrames.forEach(frame => {
            // Try to resolve the url to a path in the workspace. If it's not in the workspace,
            // just use the script.url as-is.
            if (frame.source.path) {
                const clientUrl = utils.webkitUrlToClientUrl(this._clientCWD, frame.source.path);
                if (clientUrl) {
                    frame.source.path = clientUrl;
                }
            }
        });
    }
}
