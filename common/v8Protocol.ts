/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

export class Message implements OpenDebugProtocol.V8Message {
	seq: number;
	type: string;

	public constructor(type: string) {
		this.seq = 0;
		this.type = type;
	}
}

export class Response extends Message implements OpenDebugProtocol.Response {
	request_seq: number;
	success: boolean;
	command: string;

	public constructor(request: OpenDebugProtocol.Request, message?: string) {
		super('response');
		this.request_seq = request.seq;
		this.command = request.command;
		if (message) {
			this.success = false;
			(<any>this).message = message;
		} else {
			this.success = true;
		}
	}
}

export class Event extends Message implements OpenDebugProtocol.Event {
	event: string;
	
	public constructor(event: string, body?: any) {
		super('event');
		this.event = event;
		if (body) {
			(<any>this).body = body;
		}
	}
}

export class V8Protocol {
	
	private static TIMEOUT = 3000;

	private _state: string;
	private _contentLength: number;
	private _bodyStartByteIndex: number;
	private _res: any;
	private _sequence: number;
	private _writableStream: NodeJS.WritableStream;
	private _pendingRequests: ((response: OpenDebugProtocol.Response) => void)[];
	private _callback: (event: OpenDebugProtocol.Event) => void;
	private _unresponsiveMode: boolean;
	
	public embeddedHostVersion: number = -1;
	
	
	public constructor(cb?: (event: OpenDebugProtocol.Event) => void) {
		if (cb) {
			this._callback = cb;
		} else {
			this._callback = () => {};
		}
	}
	
	public startDispatch(inStream: NodeJS.ReadableStream, outStream: NodeJS.WritableStream): void {
		this._sequence = 1;
		this._writableStream = outStream;
		this._newRes(null);
		this._pendingRequests = new Array();
		
		inStream.setEncoding('utf8');
		inStream.resume();
		inStream.on('data', (data) => this.execute(data));
		inStream.on('close', () => {
			this._callback(new Event('close'));
		});
		inStream.on('error', (error) => {
			this._callback(new Event('error'));			
		});
		outStream.on('error', (error) => {
			this._callback(new Event('error'));		
		});
	}

	public command(command: string, args: any, cb: (response: OpenDebugProtocol.Response) => void): void {
				
		var timeout = V8Protocol.TIMEOUT;
		
		var request: any = {
			command: command
		};
		if (args && Object.keys(args).length > 0) {
			request.arguments = args;
		}
		
		if (this._unresponsiveMode) {
			cb(new Response(request, 'canceled because node is unresponsive'));
			return;
		}
		
		this.send('request', request);
		
		if (cb) {
			this._pendingRequests[request.seq] = cb;
		}
		
		var timer = setTimeout(() => {
			clearTimeout(timer);
			var clb = this._pendingRequests[request.seq];
			if (clb) {
				this._unresponsiveMode = true;
				delete this._pendingRequests[request.seq];
				clb(new Response(request, 'timeout after ' + timeout + 'ms'));
				this._callback(new Event('diagnostic', { reason: 'unresponsive' }));
			}
		}, timeout);
	}
	
	public command2(command: string, args: any, timeout: number = V8Protocol.TIMEOUT): Promise<OpenDebugProtocol.Response> {
		return new Promise((completeDispatch, errorDispatch) => {
			this.command(command, args, (result: OpenDebugProtocol.Response) => {
				if (result.success) {
					completeDispatch(result);
				} else {
					errorDispatch(result);
				}
			});
		});
	}
	
	public sendEvent(event: OpenDebugProtocol.Event): void {
		this.send('event', event);
	}
	
	public sendResponse(response: OpenDebugProtocol.Response): void {
		this.send('response', response);
	}

	// ---- protected ----------------------------------------------------------

	protected dispatchRequest(request: OpenDebugProtocol.Request): void {
	}

	// ---- private ------------------------------------------------------------
	
	private send(typ: string, message: OpenDebugProtocol.V8Message): void {
		message.type = typ;
		message.seq = this._sequence++;
		var json = JSON.stringify(message);
		var data = 'Content-Length: ' + Buffer.byteLength(json, 'utf8') + '\r\n\r\n' + json;
		this._writableStream.write(data);
	}

	private _newRes(raw: string): void {
		this._res = {
			raw: raw || '',
			headers: {}
		};
		this._state = 'headers';
		this.execute('');
	}

	private internalDispatch(message: OpenDebugProtocol.V8Message): void {
		switch (message.type) {
		case 'event':
			this._callback(<OpenDebugProtocol.Event> message);
			break;
		case 'response':
			if (this._unresponsiveMode) {
				this._unresponsiveMode = false;
				this._callback(new Event('diagnostic', { reason: 'responsive' }));
			}
			var response = <OpenDebugProtocol.Response> message;
			var clb = this._pendingRequests[response.request_seq];
			if (clb) {
				delete this._pendingRequests[response.request_seq];
				clb(response);
			}
			break;
		case 'request':
			this.dispatchRequest(<OpenDebugProtocol.Request> message);
			break;
		default:
			break;
		}
	}

	private execute(d): void {
		var res = this._res;
		res.raw += d;

		switch (this._state) {
			case 'headers':
				var endHeaderIndex = res.raw.indexOf('\r\n\r\n');
				if (endHeaderIndex < 0)
					break;

				var rawHeader = res.raw.slice(0, endHeaderIndex);
				var endHeaderByteIndex = Buffer.byteLength(rawHeader, 'utf8');
				var lines = rawHeader.split('\r\n');
				for (var i = 0; i < lines.length; i++) {
					var kv = lines[i].split(/: +/);
					res.headers[kv[0]] = kv[1];
					if (kv[0] == 'Embedding-Host') {
						var match = kv[1].match(/node\sv(\d+)\.\d+\.\d+/)
						if (match.length == 2) {
							this.embeddedHostVersion = parseInt(match[1]);
						}
					}
				}

				this._contentLength = +res.headers['Content-Length'];
				this._bodyStartByteIndex = endHeaderByteIndex + 4;

				this._state = 'body';

				var len = Buffer.byteLength(res.raw, 'utf8');
				if (len - this._bodyStartByteIndex < this._contentLength) {
					break;
				}
			// pass thru
				
			case 'body':
				var resRawByteLength = Buffer.byteLength(res.raw, 'utf8');
				if (resRawByteLength - this._bodyStartByteIndex >= this._contentLength) {
					var buf = new Buffer(resRawByteLength);
					buf.write(res.raw, 0, resRawByteLength, 'utf8');
					res.body = buf.slice(this._bodyStartByteIndex, this._bodyStartByteIndex + this._contentLength).toString('utf8');
					res.body = res.body.length ? JSON.parse(res.body) : {};
					this.internalDispatch(res.body);
					this._newRes(buf.slice(this._bodyStartByteIndex + this._contentLength).toString('utf8'));
				}
				break;

			default:
				throw new Error('Unknown state');
				break;
		}
	}
}
