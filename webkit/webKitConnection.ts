/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import WebSocket = require('ws');
import http = require('http');
import {EventEmitter} from 'events';

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
    public attach(wsUrl: string): void {
        this._wsAttached = new Promise((resolve, reject) => {
            let ws = new WebSocket(wsUrl);

            ws.on('open', () => resolve(ws));
            ws.on('message', msgStr => {
                console.log('From target: ' + msgStr);
                this.onMessage(JSON.parse(msgStr));
            });
            ws.on('close', () => this.emit('close'));
        });
    }

    /**
     * Send a message which must have an id. Ok to call immediately after attach. Messages will be queued until the websocket actually attaches.
     */
    public sendMessage(message: { id: number }): Promise<any> {
        return new Promise((resolve, reject) => {
            this._pendingRequests.set(message.id, resolve);
            this._wsAttached.then(ws => {
                let msgStr = JSON.stringify(message);
                console.log('To target: ' + msgStr);
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
        return getUrl(`http://localhost:${port}/json`).then(jsonResponse => {
            let wsUrl = JSON.parse(jsonResponse)[0].webSocketDebuggerUrl;
            this._socket.attach(wsUrl);

            // init, enable debugger
            this.sendMessage('Debugger.enable');
        });
    }

    public debugger_setBreakpoint(location: WebKitProtocol.Debugger.Location, condition?: string): Promise<WebKitProtocol.Debugger.SetBreakpointResponse> {
        return this.sendMessage('Debugger.setBreakpoint', <WebKitProtocol.Debugger.SetBreakpointParams>{ location, condition });
    }

    public debugger_removeBreakpoint(breakpointId: string): Promise<WebKitProtocol.Response> {
        return this.sendMessage('Debugger.removeBreakpoint', <WebKitProtocol.Debugger.RemoveBreakpointParams>{ breakpointId })
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
            reject(e);
        });
    });
}