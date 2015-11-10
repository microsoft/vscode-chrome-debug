/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as utils from '../webkit/utilities';

export type EventHandler = (event: DebugProtocol.Event) => void;

export class AdapterProxy {
    private static INTERNAL_EVENTS = ['scriptParsed', 'clearClientContext', 'clearTargetContext'];

    public constructor(private _requestTransformers: IDebugTransformer[], private _debugAdapter: IDebugAdapter, private _eventHandler: EventHandler) {
        this._debugAdapter.registerEventHandler(event => this.onAdapterEvent(event));
    }

    public dispatchRequest(request: DebugProtocol.Request): Promise<any> {
        if (!(request.command in this._debugAdapter)) {
            return utils.errP('unknowncommand');
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

    /**
     * Pass the request arguments through the transformers. They modify the object in place.
     */
    private transformRequest(request: DebugProtocol.Request): Promise<void> {
        return this._requestTransformers
            // If the transformer implements this command, give it a chance to modify the args. Otherwise skip it
            .filter(transformer => request.command in transformer)
            .reduce(
                (p, transformer) => p.then(() => transformer[request.command](request.arguments, request.seq)),
                Promise.resolve<void>());
    }

    /**
     * Pass the response body back through the transformers in reverse order. They modify the body in place.
     */
    private transformResponse(request: DebugProtocol.Request, body: any): Promise<void> {
        if (!body) {
            return Promise.resolve<void>();
        }

        const bodyTransformMethodName = request.command + 'Response';
        const reversedTransformers = utils.reversedArr(this._requestTransformers);
        return reversedTransformers
            // If the transformer implements this command, give it a chance to modify the args. Otherwise skip it
            .filter(transformer => bodyTransformMethodName in transformer)
            .reduce(
                (p, transformer) => p.then(() => transformer[bodyTransformMethodName](body, request.seq)),
                Promise.resolve<void>());
    }

    /**
     * Pass the event back through the transformers in reverse. They modify the object in place.
     */
    private onAdapterEvent(event: DebugProtocol.Event): void {
        // try/catch because this method isn't promise-based like the rest of the class
        try {
            const reversedTransformers = utils.reversedArr(this._requestTransformers);
            reversedTransformers
                .filter(transformer => event.event in transformer)
                .forEach(
                    transformer => transformer[event.event](event));

            // Internal events should not be passed back through DebugProtocol
            if (AdapterProxy.INTERNAL_EVENTS.indexOf(event.event) < 0) {
                this._eventHandler(event);
            }
        } catch (e) {
            utils.Logger.log('Error handling adapter event: ' + (e ? e.stack : ''));
        }
    }
}
