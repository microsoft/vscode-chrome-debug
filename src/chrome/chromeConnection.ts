/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as WebSocket from 'ws';
import {EventEmitter} from 'events';

import * as utils from '../utils';
import * as logger from '../logger';
import * as chromeUtils from './chromeUtils';
import * as Chrome from './chromeDebugProtocol';

interface IMessageWithId {
    id: number;
    method: string;
    params?: string[];
}

/**
 * Implements a Request/Response API on top of a WebSocket for messages that are marked with an `id` property.
 * Emits `message.method` for messages that don't have `id`.
 */
class ResReqWebSocket extends EventEmitter {
    private _pendingRequests = new Map<number, any>();
    private _wsAttached: Promise<WebSocket>;

    public get isOpen(): boolean { return !!this._wsAttached; }

    /**
     * Attach to the given websocket url
     */
    public open(wsUrl: string): Promise<void> {
        this._wsAttached = new Promise((resolve, reject) => {
            let ws: WebSocket;
            try {
                ws = new WebSocket(wsUrl);
            } catch (e) {
                // invalid url e.g.
                reject(e.message);
                return;
            }

            // WebSocket will try to connect for 20+ seconds before timing out.
            // Implement a shorter timeout here
            setTimeout(() => reject('WebSocket connection timed out'), 10000);

            // if 'error' is fired while connecting, reject the promise
            ws.on('error', reject);
            ws.on('open', () => {
                // Replace the promise-rejecting handler
                ws.removeListener('error', reject);

                ws.on('error', e => {
                    logger.log('Websocket error: ' + e.toString());
                    this.emit('error', e);
                });

                resolve(ws);
            });
            ws.on('message', msgStr => {
                const msgObj = JSON.parse(msgStr);
                if (msgObj
                    && !(msgObj.method === 'Debugger.scriptParsed' && msgObj.params && msgObj.params.isContentScript)
                    && !(msgObj.params && msgObj.params.url && msgObj.params.url.indexOf('extensions::') === 0)) {
                    // Not really the right place to examine the content of the message, but don't log annoying extension script notifications.
                    logger.verbose('From target: ' + msgStr);
                }

                this.onMessage(msgObj);
            });
            ws.on('close', () => {
                logger.log('Websocket closed');
                this.emit('close');
            });
        });

        return <Promise<void>><any>this._wsAttached;
    }

    public close(): void {
        if (this._wsAttached) {
            this._wsAttached.then(ws => ws.close());
            this._wsAttached = null;
        }
    }

    /**
     * Send a message which must have an id. Ok to call immediately after attach. Messages will be queued until
     * the websocket actually attaches.
     */
    public sendMessage(message: IMessageWithId): Promise<any> {
        return new Promise((resolve, reject) => {
            this._pendingRequests.set(message.id, resolve);
            this._wsAttached.then(ws => {
                const msgStr = JSON.stringify(message);
                logger.verbose('To target: ' + msgStr);
                ws.send(msgStr);
            });
        });
    }

    /**
     * Wrap EventEmitter.emit in try/catch and log, for errors thrown in subscribers
     */
    public emit(event: string, ...args: any[]): boolean {
        try {
            return super.emit.apply(this, arguments);
        } catch (e) {
            logger.error('Error while handling target event: ' + e.stack);
        }
    }

    private onMessage(message: any): void {
        if (typeof message.id === 'number') {
            if (this._pendingRequests.has(message.id)) {
                // Resolve the pending request with this response
                this._pendingRequests.get(message.id)(message);
                this._pendingRequests.delete(message.id);
            } else {
                logger.error(`Got a response with id ${message.id} for which there is no pending request.`);
            }
        } else if (message.method) {
            this.emit(message.method, message.params);
        } else {
            // Message is malformed - safely stringify and log it
            let messageStr: string;
            try {
                messageStr = JSON.stringify(message);
            } catch (e) {
                messageStr = '' + message;
            }

            logger.error(`Got a response with no id nor method property: ${messageStr}`);
        }
    }
}

export type ITargetFilter = (target: Chrome.ITarget) => boolean;

/**
 * Connects to a target supporting the Chrome Debug Protocol and sends and receives messages
 */
export class ChromeConnection {
    private _nextId: number;
    private _socket: ResReqWebSocket;
    private _targetFilter: ITargetFilter;

    constructor(targetFilter?: ITargetFilter) {
        // Take the custom targetFilter, default to returning all targets
        this._targetFilter = targetFilter || (target => true);

        // this._socket should exist before attaching so consumers can call on() before attach, which fires events
        this.reset();
    }

    public get isAttached(): boolean { return this._socket.isOpen; }

    public on(eventName: string, handler: (msg: any) => void): void {
        this._socket.on(eventName, handler);
    }

    /**
     * Attach the websocket to the first available tab in the chrome instance with the given remote debugging port number.
     */
    public attach(port: number, url?: string, address?: string): Promise<void> {
        return utils.retryAsync(() => this._attach(port, url, address), /*timeoutMs*/ 6000)
            .then(() => this.sendMessage('Debugger.enable'))
            .then(() => this.sendMessage('Console.enable'))
            .then(() => { });
    }

    public _attach(port: number, targetUrl?: string, address?: string): Promise<void> {
        address = address || '127.0.0.1';
        logger.log(`Attempting to attach on ${address}:${port}`);
        return utils.getURL(`http://${address}:${port}/json`).then(jsonResponse => {
            // Validate every step of processing the response
            try {
                const responseArray = JSON.parse(jsonResponse);
                if (Array.isArray(responseArray)) {
                    // Filter out some targets as specified by the extension
                    let targets = responseArray.filter(this._targetFilter);

                    if (targetUrl) {
                        // If a url was specified, try to filter to that url
                        const filteredTargets = chromeUtils.getMatchingTargets(targets, targetUrl);
                        if (filteredTargets.length) {
                            targets = filteredTargets;
                        } else {
                            logger.error(`Warning: Can't find a target that matches: ${targetUrl}. Available pages: ${JSON.stringify(targets.map(target => target.url))}`);
                        }
                    }

                    if (targets.length) {
                        if (targets.length > 1) {
                            logger.error('Warning: Found more than one valid target page. Attaching to the first one. Available pages: ' + JSON.stringify(targets.map(target => target.url)));
                        }

                        const wsUrl = targets[0].webSocketDebuggerUrl;
                        logger.verbose(`WebSocket Url: ${wsUrl}`);
                        if (wsUrl) {
                            return this._socket.open(wsUrl);
                        }
                    }
                }
            } catch (e) {
                // JSON.parse can throw
            }

            return utils.errP('Got response from target app, but no valid target pages found');
        },
        e => {
            return utils.errP('Cannot connect to the target: ' + e.message);
        });
    }

    public close(): void {
        this._socket.close();
        this.reset();
    }

    private reset(): void {
        this._nextId = 1;
        this._socket = new ResReqWebSocket();
    }

    public debugger_setBreakpoint(location: Chrome.Debugger.Location, condition?: string): Promise<Chrome.Debugger.SetBreakpointResponse> {
        return this.sendMessage('Debugger.setBreakpoint', <Chrome.Debugger.SetBreakpointParams>{ location, condition });
    }

    public debugger_setBreakpointByUrl(url: string, lineNumber: number, columnNumber: number): Promise<Chrome.Debugger.SetBreakpointByUrlResponse> {
        return this.sendMessage('Debugger.setBreakpointByUrl', <Chrome.Debugger.SetBreakpointByUrlParams>{ url, lineNumber, columnNumber });
    }

    public debugger_removeBreakpoint(breakpointId: string): Promise<Chrome.Response> {
        return this.sendMessage('Debugger.removeBreakpoint', <Chrome.Debugger.RemoveBreakpointParams>{ breakpointId });
    }

    public debugger_stepOver(): Promise<Chrome.Response> {
        return this.sendMessage('Debugger.stepOver');
    }

    public debugger_stepIn(): Promise<Chrome.Response> {
        return this.sendMessage('Debugger.stepInto');
    }

    public debugger_stepOut(): Promise<Chrome.Response> {
        return this.sendMessage('Debugger.stepOut');
    }

    public debugger_resume(): Promise<Chrome.Response> {
        return this.sendMessage('Debugger.resume');
    }

    public debugger_pause(): Promise<Chrome.Response> {
        return this.sendMessage('Debugger.pause');
    }

    public debugger_evaluateOnCallFrame(callFrameId: string, expression: string, objectGroup = 'dummyObjectGroup', returnByValue?: boolean): Promise<Chrome.Debugger.EvaluateOnCallFrameResponse> {
        return this.sendMessage('Debugger.evaluateOnCallFrame', <Chrome.Debugger.EvaluateOnCallFrameParams>{ callFrameId, expression, objectGroup, returnByValue });
    }

    public debugger_setPauseOnExceptions(state: string): Promise<Chrome.Response> {
        return this.sendMessage('Debugger.setPauseOnExceptions', <Chrome.Debugger.SetPauseOnExceptionsParams>{ state });
    }

    public debugger_getScriptSource(scriptId: Chrome.Debugger.ScriptId): Promise<Chrome.Debugger.GetScriptSourceResponse> {
        return this.sendMessage('Debugger.getScriptSource', <Chrome.Debugger.GetScriptSourceParams>{ scriptId });
    }

    public runtime_getProperties(objectId: string, ownProperties: boolean, accessorPropertiesOnly: boolean): Promise<Chrome.Runtime.GetPropertiesResponse> {
        return this.sendMessage('Runtime.getProperties', <Chrome.Runtime.GetPropertiesParams>{ objectId, ownProperties, accessorPropertiesOnly });
    }

    public runtime_evaluate(expression: string, objectGroup = 'dummyObjectGroup', contextId?: number, returnByValue = false): Promise<Chrome.Runtime.EvaluateResponse> {
        return this.sendMessage('Runtime.evaluate', <Chrome.Runtime.EvaluateParams>{ expression, objectGroup, contextId, returnByValue });
    }

    public page_setOverlayMessage(message: string): Promise<Chrome.Response> {
        return this.sendMessage('Page.setOverlayMessage', { message });
    }

    public page_clearOverlayMessage(): Promise<Chrome.Response> {
        return this.sendMessage('Page.setOverlayMessage');
    }

    private sendMessage(method: any, params?: any): Promise<Chrome.Response> {
        return this._socket.sendMessage({
            id: this._nextId++,
            method,
            params
        });
    }
}
