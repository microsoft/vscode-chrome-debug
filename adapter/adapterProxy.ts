/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import Utilities = require('../webkit/utilities');

export type EventHandler = (event: DebugProtocol.Event) => void;

export class AdapterProxy {
    public constructor(private _requestTranslators: IDebugTranslator[], private _debugAdapter: IDebugAdapter, private _eventHandler: EventHandler) {
        this._debugAdapter.registerEventHandler(this._eventHandler);
    }

    public dispatchRequest(request: DebugProtocol.Request): Promise<any> {
        if (!(request.command in this._debugAdapter)) {
            Promise.reject('unknowncommand');
        }

        return this.translateRequest(request)
            // Pass the modified args to the adapter
            .then(() => this._debugAdapter[request.command](request.arguments))

            // Pass the body back through the translators and ensure the body is returned
            .then((body?) => {
                return this.translateResponse(request, body)
                    .then(() => body);
            });
    }

    /**
     * Pass the request arguments through the translators. They modify the object in place.
     */
    private translateRequest(request: DebugProtocol.Request): Promise<void> {
        return this._requestTranslators.reduce(
            (p, translator) => {
                // If the translator implements this command, give it a chance to modify the args. Otherwise skip it
                return request.command in translator ?
                    p.then(() => translator[request.command](request.arguments)) :
                    p;
            }, Promise.resolve<void>())
    }

    /**
     * Pass the response body back through the translators in reverse order. They modify the body in place.
     */
    private translateResponse(request: DebugProtocol.Request, body: any): Promise<void> {
        if (!body) {
            return Promise.resolve<void>();
        }

        const reversedTranslators = Utilities.reversedArr(this._requestTranslators);
        return reversedTranslators.reduce(
            (p, translator) => {
                // If the translator implements this command, give it a chance to modify the args. Otherwise skip it
                const bodyTranslateMethodName = request.command + "Response";
                return bodyTranslateMethodName in translator ?
                    p.then(() => translator[bodyTranslateMethodName](body)) :
                    p;
            }, Promise.resolve<void>());
    }
}
