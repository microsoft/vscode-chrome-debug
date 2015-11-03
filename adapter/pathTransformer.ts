/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as Utilities from '../webkit/utilities';

interface IPendingBreakpoint {
    resolve: () => void;
    args: ISetBreakpointsArgs;
}

/**
 * Converts from paths formatted  to webkit paths
 */
export class PathTransformer implements IDebugTransformer {
    private _clientCWD: string;
    private _clientUrlToWebkitUrl = new Map<string, string>();
    private _pendingBreakpointsByUrl = new Map<string, IPendingBreakpoint>();

    constructor() {
    }

    public launch(args: ILaunchRequestArgs): void {
        this._clientCWD = args.cwd;
    }

    public attach(args: IAttachRequestArgs): void {
        this._clientCWD = args.cwd;
    }

    public setBreakpoints(args: ISetBreakpointsArgs): Promise<void> {
        return new Promise<void>(resolve => {
            if (args.source.path) {
                const url = Utilities.canonicalizeUrl(args.source.path);
                if (this._clientUrlToWebkitUrl.has(url)) {
                    args.source.path = this._clientUrlToWebkitUrl.get(url);
                    resolve();
                } else {
                    // Could set breakpoints by URL here. But ODP doesn't give any way to set the position of that breakpoint when it does resolve later.
                    // This seems easier
                    // TODO caching by source.path seems wrong because it may not exist? But this implies that we haven't told ODP about this script so it may have to be set. Assert non-null?
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
        const clientUrl = Utilities.webkitUrlToClientUrl(this._clientCWD, webkitUrl);
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
                const clientUrl = Utilities.webkitUrlToClientUrl(this._clientCWD, frame.source.path);
                if (clientUrl) {
                    frame.source.path = clientUrl;
                }
            }
        });
    }
}
