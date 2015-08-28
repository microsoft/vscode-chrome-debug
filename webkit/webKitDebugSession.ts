/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {DebugSession, StoppedEvent, InitializedEvent, TerminatedEvent} from '../common/debugSession';
import {Handles} from '../common/handles';
import {WebKitConnection} from './webKitConnection';

import {Socket, createServer} from 'net';
import {spawn, ChildProcess} from 'child_process';
import os = require('os');
import nodeUrl = require('url');
import path = require('path');
import fs = require('fs');

interface IPendingBreakpoint {
    response: OpenDebugProtocol.SetBreakpointsResponse;
    args: OpenDebugProtocol.SetBreakpointsArguments;
}

export class WebKitDebugSession extends DebugSession {
    private static THREAD_ID = 1;
    private static PAGE_PAUSE_MESSAGE = 'Paused in Visual Studio Code';

    private _clientCWD: string;
    private _clientAttached: boolean;
    private _variableHandles: Handles<string>;
    private _currentStack: WebKitProtocol.Debugger.CallFrame[];
    private _pendingBreakpointsByUrl: Map<string, IPendingBreakpoint>;
    private _committedBreakpointsByScriptId: Map<WebKitProtocol.Debugger.ScriptId, WebKitProtocol.Debugger.BreakpointId[]>;

    private _chromeProc: ChildProcess;
    private _webKitConnection: WebKitConnection;

    // Scripts
    private _scriptsById: Map<WebKitProtocol.Debugger.ScriptId, WebKitProtocol.Debugger.Script>;
    private _scriptsByUrl: Map<string, WebKitProtocol.Debugger.Script>;

    public constructor(debuggerLinesStartAt1: boolean) {
        super(debuggerLinesStartAt1);
        this._variableHandles = new Handles<string>();

        this.clearEverything();
    }

    private get paused(): boolean {
        return !!this._currentStack;
    }

    private clearTargetContext(): void {
        this._scriptsById = new Map<WebKitProtocol.Debugger.ScriptId, WebKitProtocol.Debugger.Script>();
        this._scriptsByUrl = new Map<string, WebKitProtocol.Debugger.Script>();
        this._committedBreakpointsByScriptId = new Map<WebKitProtocol.Debugger.ScriptId, WebKitProtocol.Debugger.BreakpointId[]>();
    }

    private clearClientContext(): void {
        this._clientAttached = false;
        this._pendingBreakpointsByUrl = new Map<string, IPendingBreakpoint>();
    }

    protected dispatchRequest(request: OpenDebugProtocol.Request): void {
        console.log(`From client: ${request.command}(${JSON.stringify(request.arguments) })`);
        super.dispatchRequest(request);
    }

    public sendEvent(event: OpenDebugProtocol.Event): void {
        console.log(`To client: ${JSON.stringify(event) }`);
        super.sendEvent(event);
    }

    public sendResponse(response: OpenDebugProtocol.Response): void {
        console.log(`To client: ${JSON.stringify(response) }`);
        super.sendResponse(response);
    }

    protected initializeRequest(response: OpenDebugProtocol.InitializeResponse, args: OpenDebugProtocol.InitializeRequestArguments): void {
        // Nothing really to do here.
        this.sendResponse(response);
    }

    protected launchRequest(response: OpenDebugProtocol.LaunchResponse, args: OpenDebugProtocol.LaunchRequestArguments): void {
        this._clientCWD = args.workingDirectory;
        let chromeExe = args.runtimeExecutable;

        if (!chromeExe) {
            let platform = os.platform();
            if (platform === 'darwin') {
                chromeExe = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
            } else if (platform === 'win32') {
                chromeExe = os.arch() === 'x64' ?
                    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' :
                    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
            } else {
                chromeExe = '/usr/bin/google-chrome';
            }
        }

        let port = 9222;
        let chromeArgs: string[] = ['--remote-debugging-port=' + port];
        if (args.runtimeArguments) {
            chromeArgs.push(...args.runtimeArguments);
        }

        if (args.program) {
            chromeArgs.push(args.program);
        }

        if (args.arguments) {
            chromeArgs.push(...args.arguments);
        }

        this._chromeProc = spawn(chromeExe, chromeArgs);
        this._chromeProc.on('error', (err) => {
            console.error('chrome error: ' + err);
            this.terminateSession();
        });
        this._chromeProc.on('exit', () => {
            console.error('chrome exited');
            this.terminateSession();
        });

        this.attach(port).then(
            () => this.sendResponse(response),
            e => {
                response.message = e;
                response.success = false;
                this.sendResponse(response);
            });
    }

    private attach(port: number): Promise<void> {
        // ODP client is attaching - if not attached to the webkit target, create a connection and attach
        this._clientAttached = true;
        if (!this._webKitConnection) {
            this._webKitConnection = new WebKitConnection();
            this._webKitConnection.on('Debugger.paused', params => this.onDebuggerPaused(params));
            this._webKitConnection.on('Debugger.resumed', () => this.onDebuggerResumed());
            this._webKitConnection.on('Debugger.scriptParsed', params => this.onScriptParsed(params));
            this._webKitConnection.on('Debugger.globalObjectCleared', () => this.onGlobalObjectCleared());

            this._webKitConnection.on('Inspector.detached', () => this.terminateSession());
            this._webKitConnection.on('close', () => this.terminateSession());
            this._webKitConnection.on('error', () => this.terminateSession());

            return this._webKitConnection.attach(port)
                .then(
                    () => this.sendEvent(new InitializedEvent()),
                    e => {
                        this.clearEverything();
                        return Promise.reject(e);
                    });
        } else {
            return Promise.resolve<void>();
        }
    }

    /**
     * Chrome is closing, or error'd somehow, stop the debug session
     */
    private terminateSession(): void {
        if (this._clientAttached) {
            this.sendEvent(new TerminatedEvent());
        }

        this.clearEverything();
    }

    private clearEverything(): void {
        this.clearClientContext();
        this.clearTargetContext();

        if (this._webKitConnection) {
            this._webKitConnection.close();
            this._webKitConnection = null;
        }
    }

    /**
     * e.g. the target navigated
     */
    private onGlobalObjectCleared(): void {
        this.clearTargetContext();
    }

    private onDebuggerPaused(notification: WebKitProtocol.Debugger.PausedNotificationParams): void {
        this._webKitConnection.page_setOverlayMessage(WebKitDebugSession.PAGE_PAUSE_MESSAGE);
        this._currentStack = notification.callFrames;
        let scriptLocation = notification.callFrames[0].location;
        let script = this._scriptsById.get(scriptLocation.scriptId);
        let source = this.scriptToSource(script);
        let exceptionText = notification.reason === 'exception' ? notification.data.description : undefined;
        this.sendEvent(new StoppedEvent('pause', /*threadId=*/WebKitDebugSession.THREAD_ID, exceptionText));
    }

    private onDebuggerResumed(): void {
        // Called when the resume button on the page is pressed, but ODP doesn't have an event to support it.
        this._webKitConnection.page_clearOverlayMessage();
    }

    private onScriptParsed(script: WebKitProtocol.Debugger.Script): void {
        let clientUrl = this.webkitUrlToClientUrl(script.url);
        this._scriptsByUrl.set(clientUrl, script);
        this._scriptsById.set(script.scriptId, script);

        if (this._pendingBreakpointsByUrl.has(clientUrl)) {
            let pendingBreakpoint = this._pendingBreakpointsByUrl.get(clientUrl);
            this._pendingBreakpointsByUrl.delete(clientUrl);
            this.setBreakPointsRequest(pendingBreakpoint.response, pendingBreakpoint.args);
        }
    }

    protected disconnectRequest(response: OpenDebugProtocol.DisconnectResponse): void {
        this._chromeProc.kill();
        this.clearEverything();
        this.sendResponse(response);

    }

    protected attachRequest(response: OpenDebugProtocol.AttachResponse, args: OpenDebugProtocol.AttachRequestArguments): void {
        if (args.address !== 'localhost') {
            response.success = false;
            response.message = 'Remote debugging is not supported';
            this.sendResponse(response);
            return;
        }

        this.attach(args.port).then(
            () => this.sendResponse(response),
            e => {
                response.message = e;
                response.success = false;
                this.sendResponse(response);
            });
    }

    protected setBreakPointsRequest(response: OpenDebugProtocol.SetBreakpointsResponse, args: OpenDebugProtocol.SetBreakpointsArguments): void {
        let sourceUrl = canonicalizeUrl(args.source.path);
        let script =
            args.source.path ? this._scriptsByUrl.get(sourceUrl) :
                args.source.sourceReference ? this._scriptsById.get(sourceReferenceToScriptId(args.source.sourceReference)) : null;

        let debuggerLines = args.lines
            .map(clientLine => this.convertClientLineToDebugger(clientLine));

        if (script) {
            // ODP sends all current breakpoints for the script. Clear all scripts for the breakpoint then add all of them
            this.clearAllBreakpoints(script.scriptId).then(() => {
                // Call setBreakpoint for all breakpoints in the script simultaneously, join to a single promise
                return Promise.all(debuggerLines
                    .map(lineNumber => this._webKitConnection.debugger_setBreakpoint({ scriptId: script.scriptId, lineNumber })));
            }).then(responses => {
                // Ignore errors
                let successfulResponses = responses
                    .filter(response => !response.error);

                // Process responses and cache in committedBreakpoints set
                let addedBreakpointIds = successfulResponses
                    .map(response => response.result.breakpointId);
                this._committedBreakpointsByScriptId.set(script.scriptId, addedBreakpointIds);

                // Map committed breakpoints to ODP response objects and send response
                let odpBreakpoints = successfulResponses
                    .map(response => <OpenDebugProtocol.Breakpoint>{
                        verified: true,
                        line: this.convertDebuggerLineToClient(response.result.actualLocation.lineNumber)
                    });
                response.body = { breakpoints: odpBreakpoints };
                this.sendResponse(response);
            });
        } else {
            // We could set breakpoints by URL here. But ODP doesn't give any way to set the position of that breakpoint when it does resolve later.
            // This seems easier
            this._pendingBreakpointsByUrl.set(sourceUrl, { response, args });
        }
    }

    protected setExceptionBreakPointsRequest(response: OpenDebugProtocol.SetExceptionBreakpointsResponse, args: OpenDebugProtocol.SetExceptionBreakpointsArguments): void {
        let state: string;
        if (args.filters.indexOf("all") >= 0) {
            state = "all";
        } else if (args.filters.indexOf("uncaught") >= 0) {
            state = "uncaught";
        } else {
            state = "none";
        }

        this._webKitConnection.debugger_setPauseOnExceptions(state).then(() => {
            this.sendResponse(response);
        });
    }

    protected continueRequest(response: OpenDebugProtocol.ContinueResponse): void {
        this._currentStack = null;
        this._webKitConnection.debugger_resume().then(() => {
            this.sendResponse(response);
        });
    }

    protected nextRequest(response: OpenDebugProtocol.NextResponse): void {
        this._webKitConnection.debugger_stepOver().then(() => {
            this.sendResponse(response);
        });
    }

    protected stepInRequest(response: OpenDebugProtocol.StepInResponse): void {
        this._webKitConnection.debugger_stepIn().then(() => {
            this.sendResponse(response);
        });
    }

    protected stepOutRequest(response: OpenDebugProtocol.StepOutResponse): void {
        this._webKitConnection.debugger_stepOut().then(() => {
            this.sendResponse(response);
        });
    }

    protected pauseRequest(response: OpenDebugProtocol.PauseResponse): void {
        this._webKitConnection.debugger_pause().then(() => this.sendResponse(response));
    }

    protected sourceRequest(response: OpenDebugProtocol.SourceResponse, args: OpenDebugProtocol.SourceArguments): void {
        this._webKitConnection.debugger_getScriptSource(sourceReferenceToScriptId(args.sourceReference)).then(webkitResponse => {
            response.body = { content: webkitResponse.result.scriptSource };
            this.sendResponse(response);
        });
    }

    protected threadsRequest(response: OpenDebugProtocol.ThreadsResponse): void {
        response.body = {
            threads: [
                {
                    id: WebKitDebugSession.THREAD_ID,
                    name: 'Thread ' + WebKitDebugSession.THREAD_ID
                }
            ]
        };
        this.sendResponse(response);
    }

    protected stackTraceRequest(response: OpenDebugProtocol.StackTraceResponse, args: OpenDebugProtocol.StackTraceArguments): void {
        let stackFrames: OpenDebugProtocol.StackFrame[] = this._currentStack.map((callFrame: WebKitProtocol.Debugger.CallFrame, i: number) => {
            let scopes = callFrame.scopeChain.map((scope: WebKitProtocol.Debugger.Scope) => {
                return <OpenDebugProtocol.Scope>{
                    name: scope.type,
                    variablesReference: this._variableHandles.Create(scope.object.objectId),
                    expensive: true // ?
                };
            });

            return {
                id: i,
                name: callFrame.functionName || '(eval code)', // anything else?
                source: this.scriptToSource(this._scriptsById.get(callFrame.location.scriptId)),
                line: this.convertDebuggerLineToClient(callFrame.location.lineNumber),
                column: callFrame.location.columnNumber,
                scopes: scopes
            };
        });

        response.body = { stackFrames };
        this.sendResponse(response);
    }

    protected variablesRequest(response: OpenDebugProtocol.VariablesResponse, args: OpenDebugProtocol.VariablesArguments): void {
        let id = this._variableHandles.Get(args.variablesReference);
        if (id != null) {
            this._webKitConnection.runtime_getProperties(id, /*ownProperties=*/true).then(getPropsResponse => {
                if (getPropsResponse.error) {
                    this.sendErrorResponse(response, getPropsResponse.error);
                    return;
                }

                let variables = getPropsResponse.result.result.map(propDesc => {
                    if (propDesc.value && propDesc.value.type === 'object') {
                        if (propDesc.value.subtype === 'null') {
                            return { name: propDesc.name, value: 'null', variablesReference: 0 };
                        } else {
                            // We don't have the full set of values for this object yet, create a variable reference so the ODP client can ask for them
                            return { name: propDesc.name, value: propDesc.value.description, variablesReference: this._variableHandles.Create(propDesc.value.objectId) };
                        }
                    }

                    let value: string;
                    if (propDesc.value && propDesc.value.type === 'undefined') {
                        value = 'undefined';
                    } else if (typeof propDesc.get !== 'undefined') {
                        value = 'getter';
                    } else {
                        // The value is a primitive value, or something that has a description (not object, primitive, or undefined)
                        value = typeof propDesc.value.value === 'undefined' ? propDesc.value.description : propDesc.value.value;
                    }

                    return { name: propDesc.name, value, variablesReference: 0 };
                });

                response.body = { variables };
                this.sendResponse(response);
            });
        } else {
            this.sendResponse(response);
        }
    }

    protected evaluateRequest(response: OpenDebugProtocol.EvaluateResponse, args: OpenDebugProtocol.EvaluateArguments): void {
        let evalPromise: Promise<any>;
        if (this.paused) {
            let callFrameId = this._currentStack[args.frameId].callFrameId;
            evalPromise = this._webKitConnection.debugger_evaluateOnCallFrame(callFrameId, args.expression)
        } else {
            evalPromise = this._webKitConnection.runtime_evaluate(args.expression);
        }

        evalPromise.then(evalResponse => {
            let resultObj = evalResponse.result.result;
            let result: string;
            let variablesReference = 0;
            if (evalResponse.result.wasThrown) {
                response.success = false;
                response.message = evalResponse.result.exceptionDetails.text;
                this.sendResponse(response);
                return;
            } else if (resultObj.type === 'object') {
                result = 'Object';
                variablesReference = this._variableHandles.Create(resultObj.objectId);
            } else if (resultObj.type === 'undefined') {
                result = 'undefined';
            } else {
                // The result was a primitive value, or something which has a description (not object, primitive, or undefined)
                result = typeof resultObj.value === 'undefined' ? resultObj.description : resultObj.value;
            }

            response.body = { result, variablesReference };
            this.sendResponse(response);
        });
    }

    private clearAllBreakpoints(scriptId: WebKitProtocol.Debugger.ScriptId): Promise<void> {
        let committedBps = this._committedBreakpointsByScriptId.get(scriptId) || [];
        return <Promise<void>><any>Promise.all(committedBps.map(bpId => this._webKitConnection.debugger_removeBreakpoint(bpId)));
    }

    private scriptToSource(script: WebKitProtocol.Debugger.Script): OpenDebugProtocol.Source {
        return <OpenDebugProtocol.Source>{
            name: script.url,
            path: this.webkitUrlToClientUrl(script.url),
            sourceReference: scriptIdToSourceReference(script.scriptId)
        };
    }

    /**
     * http://localhost/app/scripts/code.js => d:/scripts/code.js
     * file:///d:/scripts/code.js => d:/scripts/code.js
     */
    private webkitUrlToClientUrl(url: string): string {
        // If a file:/// url is loaded in the client, just send the absolute path of the file
        if (url.substr(0, 8) === "file:///") {
            return canonicalizeUrl(url);
        }

        // If we don't have the client workingDirectory for some reason, don't try to map the url to a client path
        if (!this._clientCWD) {
            return '';
        }

        // Search the filesystem under our cwd for the file that best matches the given url
        let pathName = nodeUrl.parse(canonicalizeUrl(url)).pathname;
        if (!pathName) {
            return '';
        }

        let pathParts = pathName.split('/');
        while (pathParts.length > 0) {
            let clientUrl = path.join(this._clientCWD, pathParts.join('/'));
            if (fs.existsSync(clientUrl)) {
                return canonicalizeUrl(clientUrl); // path.join will change / to \
            }

            pathParts.shift();
        }

        return '';
    }
}

/**
 * Modify a url either from the ODP client or the webkit target to a canonical version for comparing.
 * The ODP client can handle urls in this format too.
 * file:///d:\\scripts\\code.js => d:/scripts/code.js
 * http://localhost/app/scripts/code.js => /app/scripts/code.js
 */
function canonicalizeUrl(url: string): string {
    return url
        .replace('file:///', '')
        .replace(/\\/g, '/')
        .toLowerCase();
}

function scriptToSource(script: WebKitProtocol.Debugger.Script): OpenDebugProtocol.Source {
    return <OpenDebugProtocol.Source>{ name: script.url, path: canonicalizeUrl(script.url), sourceReference: scriptIdToSourceReference(script.scriptId) };
}

function scriptIdToSourceReference(scriptId: WebKitProtocol.Debugger.ScriptId): number {
    return parseInt(scriptId);
}

function sourceReferenceToScriptId(sourceReference: number): WebKitProtocol.Debugger.ScriptId {
    return '' + sourceReference;
}
