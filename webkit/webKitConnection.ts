/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as WebSocket from 'ws';
import * as http from 'http';
import {EventEmitter} from 'events';
import * as Utilities from './utilities';
import {Logger} from './utilities';

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

    /**
     * Attach to the given websocket url
     */
    public attach(wsUrl: string): Promise<void> {
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
                    Logger.log('Websocket error: ' + e.toString());
                    this.emit('error', e);
                });

                resolve(ws);
            });
            ws.on('message', msgStr => {
                Logger.log('From target: ' + msgStr);
                this.onMessage(JSON.parse(msgStr));
            });
            ws.on('close', () => {
                Logger.log('Websocket closed');
                this.emit('close');
            });
        });

        return <Promise<void>><any>this._wsAttached;
    }

    public close(): void {
        if (this._wsAttached) {
            this._wsAttached.then(ws => ws.close());
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
                Logger.log('To target: ' + msgStr);
                ws.send(msgStr);
            });
        });
    }

    private onMessage(message: any): void {
        if (message.id) {
            if (this._pendingRequests.has(message.id)) {
                // Resolve the pending request with this response
                this._pendingRequests.get(message.id)(message);
                this._pendingRequests.delete(message.id);
            } else {
                console.error(`Got a response with id ${message.id} for which there is no pending request, weird.`);
            }
        } else if (message.method) {
            this.emit(message.method, message.params);
        }
    }
}

/**
 * Connects to a target supporting the webkit protocol and sends and receives messages
 */
export class WebKitConnection {
    private _nextId = 1;
    private _socket: ResReqWebSocket;

    constructor() {
        this._socket = new ResReqWebSocket();
    }

    public on(eventName: string, handler: (msg: any) => void): void {
        this._socket.on(eventName, handler);
    }

    /**
     * Attach the websocket to the first available tab in the chrome instance with the given remote debugging port number.
     */
    public attach(port: number): Promise<void> {
        // Retrying the download 7x * (retry download + attach 5x), and 200 ms between attempts, so like 8s total to attach to Chrome
        return Utilities.retryAsync(() => this._attach(port), 5)
            .then(() => this.sendMessage('Debugger.enable'))
            .then(() => { });
    }

    public _attach(port: number): Promise<void> {
        return Utilities.retryAsync(() => getUrl(`http://localhost:${port}/json`), 7)
            .then(jsonResponse => {
                const pages = JSON.parse(jsonResponse).filter(target => target.type === 'page');
                if (!pages.length) return Promise.reject('No valid pages found');

                const wsUrl = pages[0].webSocketDebuggerUrl;
                return this._socket.attach(wsUrl);
            });
    }

    public close(): void {
        this._socket.close();
    }

    public debugger_setBreakpoint(location: WebKitProtocol.Debugger.Location, condition?: string): Promise<WebKitProtocol.Debugger.SetBreakpointResponse> {
        return this.sendMessage('Debugger.setBreakpoint', <WebKitProtocol.Debugger.SetBreakpointParams>{ location, condition });
    }

    public debugger_removeBreakpoint(breakpointId: string): Promise<WebKitProtocol.Response> {
        return this.sendMessage('Debugger.removeBreakpoint', <WebKitProtocol.Debugger.RemoveBreakpointParams>{ breakpointId });
    }

    public debugger_stepOver(): Promise<WebKitProtocol.Response> {
        return this.sendMessage('Debugger.stepOver');
    }

    public debugger_stepIn(): Promise<WebKitProtocol.Response> {
        return this.sendMessage('Debugger.stepInto');
    }

    public debugger_stepOut(): Promise<WebKitProtocol.Response> {
        return this.sendMessage('Debugger.stepOut');
    }

    public debugger_resume(): Promise<WebKitProtocol.Response> {
        return this.sendMessage('Debugger.resume');
    }

    public debugger_pause(): Promise<WebKitProtocol.Response> {
        return this.sendMessage('Debugger.pause');
    }

    public debugger_evaluateOnCallFrame(callFrameId: string, expression: string, objectGroup = 'dummyObjectGroup', returnByValue?: boolean): Promise<WebKitProtocol.Debugger.EvaluateOnCallFrameResponse> {
        return this.sendMessage('Debugger.evaluateOnCallFrame', <WebKitProtocol.Debugger.EvaluateOnCallFrameParams>{ callFrameId, expression, objectGroup, returnByValue });
    }

    public debugger_setPauseOnExceptions(state: string): Promise<WebKitProtocol.Response> {
        return this.sendMessage('Debugger.setPauseOnExceptions', <WebKitProtocol.Debugger.SetPauseOnExceptionsParams>{ state });
    }

    public debugger_getScriptSource(scriptId: WebKitProtocol.Debugger.ScriptId): Promise<WebKitProtocol.Debugger.GetScriptSourceResponse> {
        return this.sendMessage('Debugger.getScriptSource', <WebKitProtocol.Debugger.GetScriptSourceParams>{ scriptId });
    }

    public runtime_getProperties(objectId: string, ownProperties = false): Promise<WebKitProtocol.Runtime.GetPropertiesResponse> {
        return this.sendMessage('Runtime.getProperties', <WebKitProtocol.Runtime.GetPropertiesParams>{ objectId, ownProperties });
    }

    public runtime_evaluate(expression: string, objectGroup = 'dummyObjectGroup', contextId?: number, returnByValue = false): Promise<WebKitProtocol.Runtime.EvaluateResponse> {
        return this.sendMessage('Runtime.evaluate', <WebKitProtocol.Runtime.EvaluateParams>{ expression, objectGroup, contextId, returnByValue });
    }

    public page_setOverlayMessage(message: string): Promise<WebKitProtocol.Response> {
        return this.sendMessage('Page.setOverlayMessage', { message });
    }

    public page_clearOverlayMessage(): Promise<WebKitProtocol.Response> {
        return this.sendMessage('Page.setOverlayMessage');
    }

    private sendMessage(method: any, params?: any): Promise<WebKitProtocol.Response> {
        return this._socket.sendMessage({
            id: this._nextId++,
            method,
            params
        });
    }
}

/**
 * Helper function to GET the contents of a url
 */
function getUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        http.get(url, response => {
            let jsonResponse = '';
            response.on('data', chunk => jsonResponse += chunk);
            response.on('end', () => {
                resolve(jsonResponse);
            });
        }).on('error', e => {
            reject('Cannot connect to the target');
        });
    });
}
