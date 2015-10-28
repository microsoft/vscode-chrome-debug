/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as Utilities from '../webkit/utilities';

export type EventHandler = (event: DebugProtocol.Event) => void;

export class AdapterProxy {
    private static INTERNAL_EVENTS = ['scriptParsed'];

    public constructor(private _requestTransformers: IDebugTransformer[], private _debugAdapter: IDebugAdapter, private _eventHandler: EventHandler) {
        this._debugAdapter.registerEventHandler(event => this.onAdapterEvent(event));
    }

    public dispatchRequest(request: DebugProtocol.Request): Promise<any> {
        if (!(request.command in this._debugAdapter)) {
            Promise.reject('unknowncommand');
        }

        return this.transformRequest(request)
            // Pass the modified args to the adapter
            .then(() => this._debugAdapter[request.command](request.arguments))

            // Pass the body back through the transformers and ensure the body is returned
            .then((body?) => {
                return this.transformResponse(request, body)
                    .then(() => body);
            });
    }

    private onAdapterEvent(event: DebugProtocol.Event): void {
        // No need for transformers to modify events yet
        this._requestTransformers.forEach(transformer => {
            if (event.event in transformer) {
                transformer[event.event](event);
            }
        });

        // Internal events should not be passed back through DebugProtocol
        if (AdapterProxy.INTERNAL_EVENTS.indexOf(event.event) < 0) {
            this._eventHandler(event);
        }
    }

    /**
     * Pass the request arguments through the transformers. They modify the object in place.
     */
    private transformRequest(request: DebugProtocol.Request): Promise<void> {
        return this._requestTransformers.reduce(
            (p, transformer) => {
                // If the transformer implements this command, give it a chance to modify the args. Otherwise skip it
                return request.command in transformer ?
                    p.then(() => transformer[request.command](request.arguments, request.seq)) :
                    p;
            }, Promise.resolve<void>());
    }

    /**
     * Pass the response body back through the transformers in reverse order. They modify the body in place.
     */
    private transformResponse(request: DebugProtocol.Request, body: any): Promise<void> {
        if (!body) {
            return Promise.resolve<void>();
        }

        const reversedTransformers = Utilities.reversedArr(this._requestTransformers);
        return reversedTransformers.reduce(
            (p, transformer) => {
                // If the transformer implements this command, give it a chance to modify the args. Otherwise skip it
                const bodyTransformMethodName = request.command + 'Response';
                return bodyTransformMethodName in transformer ?
                    p.then(() => transformer[bodyTransformMethodName](body, request.seq)) :
                    p;
            }, Promise.resolve<void>());
    }
}
