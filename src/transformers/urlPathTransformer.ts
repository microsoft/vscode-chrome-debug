/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {BasePathTransformer} from './basePathTransformer';

import {ISetBreakpointsArgs, ILaunchRequestArgs, IAttachRequestArgs, IStackTraceResponseBody} from '../debugAdapterInterfaces';
import * as utils from '../utils';
import * as logger from '../logger';
import * as ChromeUtils from '../chrome/chromeUtils';

interface IPendingBreakpoint {
    resolve: () => void;
    reject: (e: Error) => void;
    args: ISetBreakpointsArgs;
}

/**
 * Converts a local path from Code to a path on the target.
 */
export class UrlPathTransformer extends BasePathTransformer {
    private _webRoot: string;
    private _clientPathToTargetUrl = new Map<string, string>();
    private _targetUrlToClientPath = new Map<string, string>();
    private _pendingBreakpointsByPath = new Map<string, IPendingBreakpoint>();

    public launch(args: ILaunchRequestArgs): Promise<void> {
        this._webRoot = args.webRoot;
        return super.launch(args);
    }

    public attach(args: IAttachRequestArgs): Promise<void> {
        this._webRoot = args.webRoot;
        return super.attach(args);
    }

    public setBreakpoints(args: ISetBreakpointsArgs): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (!args.source.path) {
                resolve();
                return;
            }

            if (utils.isURL(args.source.path)) {
                // already a url, use as-is
                logger.log(`Paths.setBP: ${args.source.path} is already a URL`);
                resolve();
                return;
            }

            const path = utils.canonicalizeUrl(args.source.path);
            if (this._clientPathToTargetUrl.has(path)) {
                args.source.path = this._clientPathToTargetUrl.get(path);
                logger.log(`Paths.setBP: Resolved ${path} to ${args.source.path}`);
                resolve();
            } else {
                logger.log(`Paths.setBP: No target url cached for client path: ${path}, waiting for target script to be loaded.`);
                args.source.path = path;
                this._pendingBreakpointsByPath.set(args.source.path, { resolve, reject, args });
            }
        });
    }

    public clearTargetContext(): void {
        this._clientPathToTargetUrl = new Map<string, string>();
        this._targetUrlToClientPath = new Map<string, string>();
    }

    public scriptParsed(scriptUrl: string): string {
        const clientPath = ChromeUtils.targetUrlToClientPath(this._webRoot, scriptUrl);

        if (!clientPath) {
            // It's expected that eval scripts (debugadapter:) won't be resolved
            if (!scriptUrl.startsWith('debugadapter://')) {
                logger.log(`Paths.scriptParsed: could not resolve ${scriptUrl} to a file under webRoot: ${this._webRoot}. It may be external or served directly from the server's memory (and that's OK).`);
            }
        } else {
            logger.log(`Paths.scriptParsed: resolved ${scriptUrl} to ${clientPath}. webRoot: ${this._webRoot}`);
            this._clientPathToTargetUrl.set(clientPath, scriptUrl);
            this._targetUrlToClientPath.set(scriptUrl, clientPath);

            scriptUrl = clientPath;
        }

        if (this._pendingBreakpointsByPath.has(scriptUrl)) {
            logger.log(`Paths.scriptParsed: Resolving pending breakpoints for ${scriptUrl}`);
            const pendingBreakpoint = this._pendingBreakpointsByPath.get(scriptUrl);
            this._pendingBreakpointsByPath.delete(scriptUrl);
            this.setBreakpoints(pendingBreakpoint.args).then(pendingBreakpoint.resolve, pendingBreakpoint.reject);
        }

        return scriptUrl;
    }

    public stackTraceResponse(response: IStackTraceResponseBody): void {
        response.stackFrames.forEach(frame => {
            if (frame.source.path) {
                // Try to resolve the url to a path in the workspace. If it's not in the workspace,
                // just use the script.url as-is. It will be resolved or cleared by the SourceMapTransformer.
                const clientPath = this._targetUrlToClientPath.has(frame.source.path) ?
                    this._targetUrlToClientPath.get(frame.source.path) :
                    ChromeUtils.targetUrlToClientPath(this._webRoot, frame.source.path);

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
