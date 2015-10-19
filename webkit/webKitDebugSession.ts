/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {Response} from '../common/v8Protocol';
import {DebugSession, ErrorDestination} from '../common/debugSession';
import {WebKitDebugAdapter} from './webKitDebugAdapter';

import {AdapterProxy} from '../adapter/adapterProxy';
import {LineNumberTranslator} from '../adapter/lineNumberTranslator';

export class WebKitDebugSession extends DebugSession {
    private _adapterProxy: AdapterProxy;

    public constructor(targetLinesStartAt1: boolean, isServer: boolean = false) {
        super(targetLinesStartAt1, isServer);

        this._adapterProxy = new AdapterProxy(
            [new LineNumberTranslator(targetLinesStartAt1)],
            new WebKitDebugAdapter(),
            event => this.sendEvent(event));
    }

    /**
     * Overload sendEvent to log
     */
    public sendEvent(event: DebugProtocol.Event): void {
        console.log(`To client: ${JSON.stringify(event) }`);
        super.sendEvent(event);
    }

    /**
     * Overload sendResponse to log
     */
    public sendResponse(response: DebugProtocol.Response): void {
        console.log(`To client: ${JSON.stringify(response) }`);
        super.sendResponse(response);
    }

    /**
     * Takes a response and a promise to the response body. If the promise is successful, assigns the response body and sends the response.
     * If the promise fails, sets the appropriate response parameters and sends the response.
     */
    public sendResponseAsync(response: DebugProtocol.Response, responseP: Promise<any>): void {
        responseP.then(
            (body?) => {
                response.body = body;
                this.sendResponse(response);
            },
            e => {
                const eStr = e.toString();
                if (eStr === 'unknowncommand') {
                    this.sendErrorResponse(response, 1014, 'Unrecognized request', null, ErrorDestination.Telemetry);
                    return;
                }

                console.log(e.toString());
                response.message = e.toString();
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
            console.log(`From client: ${request.command}(${JSON.stringify(request.arguments) })`);
            this.sendResponseAsync(
                response,
                this._adapterProxy.dispatchRequest(request));
        } catch (e) {
            this.sendErrorResponse(response, 1104, 'Exception while processing request (exception: {_exception})', { _exception: e.message }, ErrorDestination.Telemetry);
        }
    }
}
