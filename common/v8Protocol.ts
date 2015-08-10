/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

export class V8Protocol {

    private _state: string;
    private _contentLength: number;
    private _bodyStartByteIndex: number;
    private _res: any;
    private _sequence: number;
    private _writableStream: NodeJS.WritableStream;
    private _pendingRequests: ((response: OpenDebugProtocol.Response) => void)[];
    private _callback: (event: OpenDebugProtocol.Event) => void;

    public constructor(cb: (event: OpenDebugProtocol.Event) => void = null) {
        this._callback = cb;
    }

    public startDispatch(inStream: NodeJS.ReadableStream, outStream: NodeJS.WritableStream): void {
        this._sequence = 1;
        this._writableStream = outStream;
        this._newRes(null);
        this._pendingRequests = new Array();

        inStream.setEncoding('utf8');
        inStream.resume();
        inStream.on('data', (data) => this.execute(data));
    }

    public command(command: string, args: any, cb: (response: OpenDebugProtocol.Response) => void): void {

        var request: any = {
            command: command
        };
        if (args && Object.keys(args).length > 0) {
            request.arguments = args;
        }
        this.send('request', request);

        if (cb) {
            this._pendingRequests[request.seq] = cb;
        }
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
        console.log('To client: ' + json);
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
            if (this._callback) {
                this._callback(<OpenDebugProtocol.Event> message);
            }
            break;
        case 'response':
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
