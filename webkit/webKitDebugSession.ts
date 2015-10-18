/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {Response} from '../common/v8Protocol';
import {DebugSession, ErrorDestination} from '../common/debugSession';
import {WebKitDebugAdapter} from './webKitDebugAdapter';

export class WebKitDebugSession extends DebugSession {
    private _debugAdapter: IDebugAdapter;

    public constructor(debuggerLinesStartAt1: boolean, isServer: boolean = false) {
        super(debuggerLinesStartAt1, isServer);

        this._debugAdapter = new WebKitDebugAdapter(debuggerLinesStartAt1, isServer);
        this._debugAdapter.registerEventHandler(event => this.sendEvent(event));
    }

    public sendEvent(event: DebugProtocol.Event): void {
        console.log(`To client: ${JSON.stringify(event) }`);
        super.sendEvent(event);
    }

    public sendResponseAsync(response: DebugProtocol.Response, responseP: Promise<any>): void {
        responseP.then(
            (body) => {
                response.body = body;
                this.sendResponse(response);
            },
            e => {
                console.log(e.toString());
                response.message = e.toString();
                response.success = false;
                this.sendResponse(response);
            });
    }

    public sendResponse(response: DebugProtocol.Response): void {
        console.log(`To client: ${JSON.stringify(response) }`);
        super.sendResponse(response);
    }

    protected dispatchRequest(request: DebugProtocol.Request): void {
        console.log(`From client: ${request.command}(${JSON.stringify(request.arguments) })`);

        const response = new Response(request);
        try {
            if (request.command in this._debugAdapter) {
                this.sendResponseAsync(
                    response,
                    this._debugAdapter[request.command](request.arguments));
            } else {
                this.sendErrorResponse(response, 1014, "unrecognized request", null, ErrorDestination.Telemetry);
            }
        } catch (e) {
            this.sendErrorResponse(response, 1104, "exception while processing request (exception: {_exception})", { _exception: e.message }, ErrorDestination.Telemetry);
        }
    }
}
