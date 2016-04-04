/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {DebugProtocol} from 'vscode-debugprotocol';

import {IDebugAdapter, IDebugTransformer} from './chrome/debugAdapterInterfaces';
import * as utils from './utils';
import * as logger from './logger';

export type EventHandler = (event: DebugProtocol.Event) => void;

/**
 * Keeps a set of IDebugTransformers and an IDebugAdapter. Has one public method - dispatchRequest, which passes a request through each
 * IDebugTransformer, then to the IDebugAdapter.
 */
export class AdapterProxy {
    private static INTERNAL_EVENTS = ['scriptParsed', 'clearClientContext', 'clearTargetContext'];

    private _requestTransformers: IDebugTransformer[];
    private _debugAdapter: IDebugAdapter;
    private _eventHandler: EventHandler;

    public constructor(requestTransformers: IDebugTransformer[], debugAdapter: IDebugAdapter, eventHandler: EventHandler) {
        this._requestTransformers = requestTransformers;
        this._debugAdapter = debugAdapter;
        this._eventHandler = eventHandler;

        this._debugAdapter.registerEventHandler(event => this.onAdapterEvent(event));
    }

    /**
     * Passes the request through all IDebugTransformers, then the IDebugAdapter. The request from the IDebugAdapter is passed through all the
     * IDebugTransformers in reverse.
     * Returns a Promise that resolves to the transformed response body.
     */
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
            logger.log('Error handling adapter event: ' + (e ? e.stack : ''));
        }
    }
}
