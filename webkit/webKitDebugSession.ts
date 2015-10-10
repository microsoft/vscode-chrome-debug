/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {DebugSession, StoppedEvent, InitializedEvent, TerminatedEvent} from '../common/debugSession';
import {Handles} from '../common/handles';
import {WebKitConnection} from './webKitConnection';
import Utilities = require('./utilities');
import {ISourceMaps, SourceMaps} from './sourceMaps';

import {Socket, createServer} from 'net';
import {spawn, ChildProcess} from 'child_process';
import nodeUrl = require('url');
import path = require('path');
import fs = require('fs');

interface IPendingBreakpoint {
    response: DebugProtocol.SetBreakpointsResponse;
    args: DebugProtocol.SetBreakpointsArguments;
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
    private _sourceMaps: ISourceMaps;

    private _chromeProc: ChildProcess;
    private _webKitConnection: WebKitConnection;

    // Scripts
    private _scriptsById: Map<WebKitProtocol.Debugger.ScriptId, WebKitProtocol.Debugger.Script>;
    private _scriptsByUrl: Map<string, WebKitProtocol.Debugger.Script>;

    private _setBreakpointsRequestQ: Promise<void>;

    public constructor(debuggerLinesStartAt1: boolean, isServer: boolean = false) {
        super(debuggerLinesStartAt1, isServer);
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
        this._setBreakpointsRequestQ = Promise.resolve<void>();
    }

    private clearClientContext(): void {
        this._clientAttached = false;
        this._pendingBreakpointsByUrl = new Map<string, IPendingBreakpoint>();
    }

    protected dispatchRequest(request: DebugProtocol.Request): void {
        console.log(`From client: ${request.command}(${JSON.stringify(request.arguments) })`);
        super.dispatchRequest(request);
    }

    public sendEvent(event: DebugProtocol.Event): void {
        console.log(`To client: ${JSON.stringify(event) }`);
        super.sendEvent(event);
    }

    public sendResponse(response: DebugProtocol.Response): void {
        console.log(`To client: ${JSON.stringify(response) }`);
        super.sendResponse(response);
    }

    protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
        if (args.sourceMaps) {
            this._sourceMaps = new SourceMaps(args.generatedCodeDirectory);
		}

        this.sendResponse(response);
    }

    protected launchRequest(response: DebugProtocol.LaunchResponse, args: DebugProtocol.LaunchRequestArguments): void {
        this._clientCWD = args.workingDirectory;
        let chromeExe = args.runtimeExecutable || Utilities.getBrowserPath();

        let port = 9222;
        let chromeArgs: string[] = ['--remote-debugging-port=' + port];
        if (args.runtimeArguments) {
            chromeArgs.push(...args.runtimeArguments);
        }

        // Can html files be sourcemapped? May as well try.
        if (args.program) {
            if (this._sourceMaps) {
                const generatedPath = this._sourceMaps.MapPathFromSource(args.program);
                if (generatedPath) {
                    args.program = generatedPath;
                }
            }

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
        this._currentStack = null;
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

    protected disconnectRequest(response: DebugProtocol.DisconnectResponse): void {
        this._chromeProc.kill();
        this.clearEverything();
        this.sendResponse(response);

    }

    protected attachRequest(response: DebugProtocol.AttachResponse, args: DebugProtocol.AttachRequestArguments): void {
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

    protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
        // Do just one setBreakpointsRequest at a time to avoid interleaving breakpoint removed/breakpoint added requests to Chrome
        this._setBreakpointsRequestQ = this._setBreakpointsRequestQ.then(() => {
            return this._setBreakpoints(response, args);
        });
    }

    private _setBreakpoints(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): Promise<void> {
        let targetScript: WebKitProtocol.Debugger.Script;
        let path: string;
        if (args.source.path) {
            path = args.source.path;
            if (this._sourceMaps) {
                path = this._sourceMaps.MapPathFromSource(args.source.path) || args.source.path;
            }

            targetScript = this._scriptsByUrl.get(canonicalizeUrl(path));
        } else if (args.source.sourceReference) {
            // TODO de-sourcemap
            targetScript = this._scriptsById.get(sourceReferenceToScriptId(args.source.sourceReference));
        } else if (args.source.name) {
            // ??
        }

        if (targetScript) {
            // ODP sends all current breakpoints for the script. Clear all scripts for the breakpoint then add all of them
            return this.clearAllBreakpoints(targetScript.scriptId).then(() => {
                const debuggerLines = args.lines
                    .map(clientLine => this.convertClientLineToDebugger(clientLine))
                    .map(debuggerLine => {
                        // Sourcemap lines
                        if (this._sourceMaps) {
                            const mapped = this._sourceMaps.MapFromSource(args.source.path, debuggerLine, /*column=*/0);
                            return mapped ? mapped.line : debuggerLine;
                        } else {
                            return debuggerLine;
                        }
                    });

                // Call setBreakpoint for all breakpoints in the script simultaneously, join to a single promise
                return Promise.all(debuggerLines
                    .map(lineNumber => this._webKitConnection.debugger_setBreakpoint({ scriptId: targetScript.scriptId, lineNumber })));
            }).then(responses => {
                // Ignore errors
                let successfulResponses = responses
                    .filter(response => !response.error);

                // Process responses and cache in committedBreakpoints set
                let addedBreakpointIds = successfulResponses
                    .map(response => response.result.breakpointId);
                this._committedBreakpointsByScriptId.set(targetScript.scriptId, addedBreakpointIds);

                // Map committed breakpoints to ODP response objects and send response
                let odpBreakpoints = successfulResponses
                    .map(response => {
                        let line = response.result.actualLocation.lineNumber;
                        if (this._sourceMaps) {
                            let mapped = this._sourceMaps.MapToSource(path, response.result.actualLocation.lineNumber, response.result.actualLocation.columnNumber);
                            if (mapped) {
                                line = mapped.line;
                            }
                        }

                        return <DebugProtocol.Breakpoint>{
                            verified: true,
                            line: this.convertDebuggerLineToClient(line)
                        }
                    });

                response.body = { breakpoints: odpBreakpoints };
                this.sendResponse(response);
            });
        } else {
            // We could set breakpoints by URL here. But ODP doesn't give any way to set the position of that breakpoint when it does resolve later.
            // This seems easier
            // TODO caching by source.path seems wrong because it may not exist? But this implies that we haven't told ODP about this script so it may have to be set. Assert non-null?
            this._pendingBreakpointsByUrl.set(canonicalizeUrl(args.source.path), { response, args });
            return Promise.resolve<void>();
        }
    }

    protected setExceptionBreakPointsRequest(response: DebugProtocol.SetExceptionBreakpointsResponse, args: DebugProtocol.SetExceptionBreakpointsArguments): void {
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

    protected continueRequest(response: DebugProtocol.ContinueResponse): void {
        this._webKitConnection.debugger_resume().then(() => {
            this.sendResponse(response);
        });
    }

    protected nextRequest(response: DebugProtocol.NextResponse): void {
        this._webKitConnection.debugger_stepOver().then(() => {
            this.sendResponse(response);
        });
    }

    protected stepInRequest(response: DebugProtocol.StepInResponse): void {
        this._webKitConnection.debugger_stepIn().then(() => {
            this.sendResponse(response);
        });
    }

    protected stepOutRequest(response: DebugProtocol.StepOutResponse): void {
        this._webKitConnection.debugger_stepOut().then(() => {
            this.sendResponse(response);
        });
    }

    protected pauseRequest(response: DebugProtocol.PauseResponse): void {
        this._webKitConnection.debugger_pause().then(() => this.sendResponse(response));
    }

    protected sourceRequest(response: DebugProtocol.SourceResponse, args: DebugProtocol.SourceArguments): void {
        this._webKitConnection.debugger_getScriptSource(sourceReferenceToScriptId(args.sourceReference)).then(webkitResponse => {
            response.body = { content: webkitResponse.result.scriptSource };
            this.sendResponse(response);
        });
    }

    protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
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

    protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
        let stackFrames: DebugProtocol.StackFrame[] = this._currentStack.map((callFrame: WebKitProtocol.Debugger.CallFrame, i: number) => {
            return {
                id: i,
                name: callFrame.functionName || '(eval code)', // anything else?
                source: this.scriptToSource(this._scriptsById.get(callFrame.location.scriptId)),
                line: this.convertDebuggerLineToClient(callFrame.location.lineNumber),
                column: callFrame.location.columnNumber
            };
        });

        response.body = { stackFrames };
        this.sendResponse(response);
    }

    protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {
        let scopes = this._currentStack[args.frameId].scopeChain.map((scope: WebKitProtocol.Debugger.Scope) => {
            console.log(scope.type);
            return <DebugProtocol.Scope>{
                name: scope.type,
                variablesReference: this._variableHandles.create(scope.object.objectId),
                expensive: true // ?
            };
        });

        response.body = { scopes };
        this.sendResponse(response);
    }

    protected variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): void {
        let id = this._variableHandles.get(args.variablesReference);
        if (id != null) {
            this._webKitConnection.runtime_getProperties(id, /*ownProperties=*/true).then(getPropsResponse => {
                let variables = getPropsResponse.error ? [] :
                    getPropsResponse.result.result.map(propDesc => this.propertyDescriptorToODPVariable(propDesc));

                response.body = { variables };
                this.sendResponse(response);
            });
        } else {
            this.sendResponse(response);
        }
    }

    protected evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): void {
        let evalPromise: Promise<any>;
        if (this.paused) {
            let callFrameId = this._currentStack[args.frameId].callFrameId;
            evalPromise = this._webKitConnection.debugger_evaluateOnCallFrame(callFrameId, args.expression);
        } else {
            evalPromise = this._webKitConnection.runtime_evaluate(args.expression);
        }

        evalPromise.then(evalResponse => {
            let resultObj: WebKitProtocol.Runtime.RemoteObject = evalResponse.result.result;
            let result: string;
            let variablesReference = 0;
            if (evalResponse.result.wasThrown) {
                response.success = false;
                response.message = evalResponse.result.exceptionDetails.text;
                this.sendResponse(response);
                return;
            } else if (resultObj.type === 'object') {
                result = 'Object';
                variablesReference = this._variableHandles.create(resultObj.objectId);
            } else if (resultObj.type === 'undefined') {
                result = 'undefined';
            } else {
                // The result was a primitive value, or something which has a description (not object, primitive, or undefined)
                result = '' + (typeof resultObj.value === 'undefined' ? resultObj.description : resultObj.value);
            }

            response.body = { result, variablesReference };
            this.sendResponse(response);
        });
    }

    private propertyDescriptorToODPVariable(propDesc: WebKitProtocol.Runtime.PropertyDescriptor): DebugProtocol.Variable {
        if (propDesc.value && propDesc.value.type === 'object') {
            if (propDesc.value.subtype === 'null') {
                return { name: propDesc.name, value: 'null', variablesReference: 0 };
            } else {
                // We don't have the full set of values for this object yet, create a variable reference so the ODP client can ask for them
                return { name: propDesc.name, value: propDesc.value.description + '', variablesReference: this._variableHandles.create(propDesc.value.objectId) };
            }
        }

        let value: string;
        if (propDesc.value && propDesc.value.type === 'undefined') {
            value = 'undefined';
        } else if (typeof propDesc.get !== 'undefined') {
            value = 'getter';
        } else {
            // The value is a primitive value, or something that has a description (not object, primitive, or undefined). And force to be string
            value = '' + (typeof propDesc.value.value === 'undefined' ? propDesc.value.description : propDesc.value.value);
        }

        return { name: propDesc.name, value, variablesReference: 0 };
    }

    private clearAllBreakpoints(scriptId: WebKitProtocol.Debugger.ScriptId): Promise<void> {
        let committedBps = this._committedBreakpointsByScriptId.get(scriptId) || [];

        // Remove breakpoints one at a time. Seems like it would be ok to send the removes all at once,
        // but there is a chrome bug where when removing 5+ or so breakpoints at once, it gets into a weird
        // state where later adds on the same line will fail with "breakpoint already exists" even though it
        // does not break there.
        return committedBps.reduce<Promise<void>>((p, bpId) => {
            return p.then(() => this._webKitConnection.debugger_removeBreakpoint(bpId)).then(() => { });
        }, Promise.resolve<void>());
    }

    private scriptToSource(script: WebKitProtocol.Debugger.Script): DebugProtocol.Source {
        return <DebugProtocol.Source>{
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

function scriptToSource(script: WebKitProtocol.Debugger.Script): DebugProtocol.Source {
    return <DebugProtocol.Source>{ name: script.url, path: canonicalizeUrl(script.url), sourceReference: scriptIdToSourceReference(script.scriptId) };
}

function scriptIdToSourceReference(scriptId: WebKitProtocol.Debugger.ScriptId): number {
    return parseInt(scriptId);
}

function sourceReferenceToScriptId(sourceReference: number): WebKitProtocol.Debugger.ScriptId {
    return '' + sourceReference;
}
