/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import WebSocket = require('ws');
import http = require('http');
import {EventEmitter} from 'events';

export class WebSocketWrapper extends EventEmitter {
	private _websocketConnect: Promise<WebSocket>;
	private _pendingRequests = new Map<number, any>();

    public attachToUrl(url: string): void {
        this._websocketConnect = new Promise<WebSocket>((resolve, reject) => {
			// Get the websocket url
			getUrl(url).then(jsonResponse => {
				var wsUrl = JSON.parse(jsonResponse)[0].webSocketDebuggerUrl;
				var ws = new WebSocket(wsUrl);
				ws.on('open', () => {
					console.log('open');
					resolve(ws);
				});

				ws.on('message', message => {
					console.log('received ' + message);
					this.onMessage(JSON.parse(message));
				});
			}, e => {
				// Chrome isn't running or not set up correctly?
			});
		});
    }

	protected sendMessage(message: { id: number }): Promise<any> {
		return new Promise((resolve, reject) => {
			this._pendingRequests.set(message.id, resolve);
			this._websocketConnect.then(ws =>
				ws.send(JSON.stringify(message)));
		});
	}

	private onMessage(message: any): void {
		if (message.id) {
			var response = message;
			if (this._pendingRequests.has(response.id)) {
				// Resolve the pending request with this response
				this._pendingRequests.get(response.id)(response);
				this._pendingRequests.delete(response.id);
			} else {
				console.error(`Got a response with id ${response.id} for which there is no pending request, weird.`);
			}
		} else if (message.method) {
			var notification = message;
			this.emit(notification.method, notification.params);
		}
	}
}

export class WebKitConnection extends WebSocketWrapper {
	private _nextId = 1;

	public attach(port: number): void {
		super.attachToUrl(`http://localhost:${port}/json`);

		// init, enable debugger
		this.sendMessage({
			id: this._nextId++,
			method: "Debugger.enable"
		});
	}

	public setBreakpoint(location: WebKitProtocol.Location, condition?: string): Promise<WebKitProtocol.SetBreakpointResponse> {
		return this.sendMessage(<WebKitProtocol.SetBreakpointRequest>{
			id: this._nextId++,
			method: "Debugger.setBreakpoint",
			params: {
				location: location,
				condition: condition
			}
		});
	}
}

/**
 * Helper function to GET the contents of a url
 */
function getUrl(url: string): Promise<string> {
	return new Promise((resolve, reject) => {
		http.get(url, response => {
			var jsonResponse = "";
			response.on('data', chunk => jsonResponse += chunk);
			response.on('end', () => {
				resolve(jsonResponse);
			});
		}).on('error', e => {
			reject(e);
		});
	});
}