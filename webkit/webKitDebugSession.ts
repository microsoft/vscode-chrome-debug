/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {Response} from '../common/v8Protocol';
import {OutputEvent} from '../common/debugSession';
import {DebugSession, ErrorDestination} from '../common/debugSession';

import {WebKitDebugAdapter} from './webKitDebugAdapter';
import {Logger} from './utilities';

import {AdapterProxy} from '../adapter/adapterProxy';
import {LineNumberTransformer} from '../adapter/lineNumberTransformer';
import {PathTransformer} from '../adapter/pathTransformer';
import {SourceMapTransformer} from '../adapter/sourceMaps/sourceMapTransformer';

export class WebKitDebugSession extends DebugSession {
    private _adapterProxy: AdapterProxy;

    public constructor(targetLinesStartAt1: boolean, isServer: boolean = false) {
        super(targetLinesStartAt1, isServer);

        Logger.init(isServer, msg => this.sendEvent(new OutputEvent(`  ›${msg}\n`)));
        process.addListener('unhandledRejection', reason => {
            Logger.log(`******** ERROR! Unhandled promise rejection: ${reason}`);
        });

        this._adapterProxy = new AdapterProxy(
            [
                new LineNumberTransformer(targetLinesStartAt1),
                new SourceMapTransformer(),
                new PathTransformer()
            ],
            new WebKitDebugAdapter(),
            event => this.sendEvent(event));
    }

    /**
     * Overload sendEvent to log
     */
    public sendEvent(event: DebugProtocol.Event): void {
        if (event.event !== 'output') {
            // Don't create an infinite loop...
            Logger.log(`To client: ${JSON.stringify(event) }`);
        }

        super.sendEvent(event);
    }

    /**
     * Overload sendResponse to log
     */
    public sendResponse(response: DebugProtocol.Response): void {
        Logger.log(`To client: ${JSON.stringify(response) }`);
        super.sendResponse(response);
    }

    /**
     * Takes a response and a promise to the response body. If the promise is successful, assigns the response body and sends the response.
     * If the promise fails, sets the appropriate response parameters and sends the response.
     */
    private sendResponseAsync(request: DebugProtocol.Request, response: DebugProtocol.Response, responseP: Promise<any>): void {
        responseP.then(
            (body?) => {
                response.body = body;
                this.sendResponse(response);
            },
            e => {
                const eStr = e ? e.message : 'Unknown error';
                if (eStr === 'Error: unknowncommand') {
                    this.sendErrorResponse(response, 1014, '[webkit-debug-adapter] Unrecognized request: ' + request.command, null, ErrorDestination.Telemetry);
                    return;
                }

                if (request.command === 'evaluate') {
                    // Errors from evaluate show up in the console or watches pane. Doesn't seem right
                    // as it's not really a failed request. So it doesn't need the tag and worth special casing.
                    response.message = eStr;
                } else {
                    // These errors show up in the message bar at the top (or nowhere), sometimes not obvious that they
                    // come from the adapter
                    response.message = '[webkit-debug-adapter] ' + eStr;
                    Logger.log('Error: ' + e ? e.stack : eStr);
                }

                response.success = false;
                this.sendResponse(response);
            });
    }

    /**
     * Overload dispatchRequest to dispatch to the adapter proxy instead of debugSession's methods for each request.
     */
    protected dispatchRequest(request: DebugProtocol.Request): void {
        const response = new Response(request);
        try {
            Logger.log(`From client: ${request.command}(${JSON.stringify(request.arguments) })`);
            this.sendResponseAsync(
                request,
                response,
                this._adapterProxy.dispatchRequest(request));
        } catch (e) {
            this.sendErrorResponse(response, 1104, 'Exception while processing request (exception: {_exception})', { _exception: e.message }, ErrorDestination.Telemetry);
        }
    }
}
