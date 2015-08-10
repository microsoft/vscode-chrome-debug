/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {DebugSession} from '../common/DebugSession';
import {Handles} from '../common/Handles';
import {Socket, createServer} from 'net';
import {readFileSync} from 'fs';
import {spawn, ChildProcess} from 'child_process';
import {WebKitConnection} from './webkitConnection';

interface IPendingBreakpoint {
    response: OpenDebugProtocol.SetBreakpointsResponse;
    args: OpenDebugProtocol.SetBreakpointsArguments;
}

class WebkitDebugSession extends DebugSession {
    private _sourceFile: string;
    private _currentLine: number;
    private _variableHandles: Handles<string>;
    private _currentStack: WebKitProtocol.CallFrame[];
    private _pendingBreakpointsByUrl = new Map<string, IPendingBreakpoint>();

    private _chromeProc: any;
    private _webKitConnection: WebKitConnection;

    // Scripts
    private _scriptsById = new Map<string, WebKitProtocol.Script>();
    private _scriptsByUrl = new Map<string, WebKitProtocol.Script>();

    public constructor(debuggerLinesStartAt1: boolean) {
        super(debuggerLinesStartAt1);
        this._sourceFile = null;
        this._currentLine = 0;
        this._variableHandles = new Handles<string>();
    }

    protected initializeRequest(response: OpenDebugProtocol.InitializeResponse, args: OpenDebugProtocol.InitializeRequestArguments): void {
        // give UI a chance to set breakpoints (??)
        this.sendResponse(response);
        this.sendEvent(this.createInitializedEvent());
    }

    protected launchRequest(response: OpenDebugProtocol.LaunchResponse, args: OpenDebugProtocol.LaunchRequestArguments): void {
        let chromeExe = args.runtimeExecutable || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
        let port = 9222;

        let chromeArgs: string[] = [];
        chromeArgs.push('--remote-debugging-port=9222');

        if (args.runtimeArguments) {
            for (let a of args.runtimeArguments) {
                chromeArgs.push(a);
            }
        }

        chromeArgs.push(args.program);

        if (args.arguments) {
            for (let a of args.arguments) {
                chromeArgs.push(a);
            }
        }

        this._chromeProc = spawn(chromeExe, chromeArgs);
        this._chromeProc.on('error', (err) => {
            console.error('chrome error: ' + err);
            this.sendEvent(this.createTerminatedEvent());
        });
        this._chromeProc.on('exit', () => {
            console.error('chrome terminated');
            this.sendEvent(this.createTerminatedEvent());
        });

        this.attach(port, response);
    }

    private attach(port: number, response: OpenDebugProtocol.Response): void {
        this._webKitConnection = new WebKitConnection();
        this._webKitConnection.on('Debugger.paused', params => this.onDebuggerPaused(params));
        this._webKitConnection.on('Debugger.scriptParsed', params => this.onScriptParsed(params));
        this._webKitConnection.attach(9222);
    }

    private onDebuggerPaused(notification: WebKitProtocol.PausedNotificationParams): void {
        this._currentStack = notification.callFrames;
        let scriptLocation = notification.callFrames[0].location;
        let script = this._scriptsById.get(scriptLocation.scriptId);
        let source = scriptToSource(script);
        this.sendEvent(this.createStoppedEvent('pause', source, scriptLocation.lineNumber, scriptLocation.columnNumber, /*threadId=*/4711));
    }

    private onScriptParsed(script: WebKitProtocol.Script): void {
        var scriptUrl = canonicalizeUrl(script.url);
        this._scriptsByUrl.set(scriptUrl, script);
        this._scriptsById.set(script.scriptId, script);

        if (this._pendingBreakpointsByUrl.has(scriptUrl)) {
            var pendingBreakpoint = this._pendingBreakpointsByUrl.get(scriptUrl);
            this._pendingBreakpointsByUrl.delete(scriptUrl);
            this.setBreakPointsRequest(pendingBreakpoint.response, pendingBreakpoint.args);
        }
    }

    protected disconnectRequest(response: OpenDebugProtocol.DisconnectResponse): void {
        this.sendResponse(response);
    }

    protected attachRequest(response: OpenDebugProtocol.AttachResponse, args: OpenDebugProtocol.AttachRequestArguments): void {
        let port = args.port;
        this.attach(port, response);
        this.sendResponse(response);
    }

    protected setBreakPointsRequest(response: OpenDebugProtocol.SetBreakpointsResponse, args: OpenDebugProtocol.SetBreakpointsArguments): void {
        let sourceUrl = canonicalizeUrl(args.source.path);
        let script =
            args.source.path ? this._scriptsByUrl.get(sourceUrl) :
                args.source.sourceReference ? this._scriptsById.get('' + args.source.sourceReference) : null;

        if (script) {
            let responsePromises = args.lines
                .map(line => this._webKitConnection.setBreakpoint({ lineNumber: line, scriptId: script.scriptId }));

            Promise.all(<Iterable<any>><any>responsePromises) // Not sure why array isn't considered iterable here
                .then(responses => {
                    let breakpoints = responses.map(response => {
                        return <OpenDebugProtocol.Breakpoint>{
                            verified: true,
                            line: response.result.actualLocation.lineNumber
                        };
                    });

                    response.body = { breakpoints };
                    this.sendResponse(response);
                });
        } else {
            this._pendingBreakpointsByUrl.set(sourceUrl, { response, args });
        }
    }

    protected setExceptionBreakPointsRequest(response: OpenDebugProtocol.SetExceptionBreakpointsResponse, args: OpenDebugProtocol.SetExceptionBreakpointsArguments): void {
        this.sendResponse(response);
    }

    protected continueRequest(response: OpenDebugProtocol.ContinueResponse): void {
        this.sendResponse(response);
    }

    protected nextRequest(response: OpenDebugProtocol.NextResponse): void {
        this.sendResponse(response);
    }

    protected stepInRequest(response: OpenDebugProtocol.StepInResponse): void {
        this.sendResponse(response);
    }

    protected stepOutRequest(response: OpenDebugProtocol.StepOutResponse): void {
        this.sendResponse(response);
    }

    protected pauseRequest(response: OpenDebugProtocol.PauseResponse): void {
        this.sendResponse(response);
    }

    protected sourceRequest(response: OpenDebugProtocol.SourceResponse, args: OpenDebugProtocol.SourceArguments): void {
        this.sendResponse(response);
    }

    protected threadsRequest(response: OpenDebugProtocol.ThreadsResponse): void {
        response.body = {
            threads: [
                {
                    id: 4711,
                    name: 'thread 1'
                }
            ]
        };
        this.sendResponse(response);
    }

    protected stackTraceRequest(response: OpenDebugProtocol.StackTraceResponse, args: OpenDebugProtocol.StackTraceArguments): void {
        let stackFrames: OpenDebugProtocol.StackFrame[] = this._currentStack.map((callFrame: WebKitProtocol.CallFrame, i: number) => {
            let scopes = callFrame.scopeChain.map((scope: WebKitProtocol.Scope) => {
                return <OpenDebugProtocol.Scope>{
                    name: scope.type,
                    variablesReference: 1,
                    expensive: true
                };
            });

            return {
                id: i,
                name: callFrame.functionName,
                source: scriptToSource(this._scriptsById.get(callFrame.location.scriptId)),
                line: callFrame.location.lineNumber,
                column: callFrame.location.columnNumber,
                scopes: scopes
            };
        });

        response.body = {
            stackFrames
        };
        this.sendResponse(response);
    }

    protected variablesRequest(response: OpenDebugProtocol.VariablesResponse, args: OpenDebugProtocol.VariablesArguments): void {
        let variables = [];
        let id = this._variableHandles.Get(args.variablesReference);
        if (id != null) {
            variables.push({
                name: id + '_i',
                value: '123',
                variablesReference: 0
            });
            variables.push({
                name: id + '_f',
                value: '3.14',
                variablesReference: 0
            });
            variables.push({
                name: id + '_s',
                value: 'hello world',
                variablesReference: 0
            });
            variables.push({
                name: id + '_o',
                value: 'Object',
                variablesReference: this._variableHandles.Create('object_')
            });
        }

        response.body = {
            variables: variables
        };
        this.sendResponse(response);
    }

    protected evaluateRequest(response: OpenDebugProtocol.EvaluateResponse, args: OpenDebugProtocol.EvaluateArguments): void {
        this.sendResponse(response);
    }
}

/**
 * Modify a url either from the ODP client or the webkit target to a canonical version for comparing.
 * The ODP client can handle urls in this format too.
 */
function canonicalizeUrl(url: string): string {
    return url
        .replace('file:///', '')
        .replace(/\\/g, '/')
        .toLowerCase();
}

function scriptToSource(script: WebKitProtocol.Script): OpenDebugProtocol.Source {
    return <OpenDebugProtocol.Source>{ name: script.url, path: canonicalizeUrl(script.url), sourceReference: parseInt(script.scriptId) };
}

// parse arguments
let port = 0;
let args = process.argv.slice(2);
args.forEach(function(val, index, array) {
    let portMatch = /^--server=(\d{2,5})$/.exec(val);
    if (portMatch !== null) {
        port = parseInt(portMatch[1], 10);
    }
});

// start session
let mock = new WebkitDebugSession(false);
if (port > 0) {
    console.error('waiting for v8 protocol on port ' + port);
    createServer(function(socket) {
        console.error('>> accepted connection from client');
        socket.on('end', () => {
            console.error('>> client connection closed');
        });
        mock.startDispatch(socket, socket);
    }).listen(port);
} else {
    console.error('waiting for v8 protocol on stdin/stdout');
    mock.startDispatch(process.stdin, process.stdout);
}
