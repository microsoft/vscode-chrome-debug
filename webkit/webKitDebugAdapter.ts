/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {DebugSession, StoppedEvent, InitializedEvent, TerminatedEvent} from '../common/debugSession';
import {Handles} from '../common/handles';
import {WebKitConnection} from './webKitConnection';
import Utilities = require('./utilities');
import {ISourceMaps, SourceMaps} from './sourceMaps';

import {spawn, ChildProcess} from 'child_process';
import nodeUrl = require('url');
import path = require('path');
import fs = require('fs');

interface IPendingBreakpoint {
    resolve: (response: SetBreakpointsResponseBody) => void;
    reject: (error?: any) => void;
    args: DebugProtocol.SetBreakpointsArguments;
}

export class WebKitDebugAdapter implements IDebugAdapter {
    private static THREAD_ID = 1;
    private static PAGE_PAUSE_MESSAGE = 'Paused in Visual Studio Code';

    private _clientLinesStartAt1: boolean;

    private _clientCWD: string;
    private _clientAttached: boolean;
    private _targetAttached: boolean;
    private _variableHandles: Handles<string>;
    private _currentStack: WebKitProtocol.Debugger.CallFrame[];
    private _pendingBreakpointsByUrl: Map<string, IPendingBreakpoint>;
    private _committedBreakpointsByScriptId: Map<WebKitProtocol.Debugger.ScriptId, WebKitProtocol.Debugger.BreakpointId[]>;
    private _sourceMaps: ISourceMaps;
    private _overlayHelper: Utilities.DebounceHelper;

    private _chromeProc: ChildProcess;
    private _webKitConnection: WebKitConnection;
    private _eventHandler: (event: DebugProtocol.Event) => void;

    // Scripts
    private _scriptsById: Map<WebKitProtocol.Debugger.ScriptId, WebKitProtocol.Debugger.Script>;
    private _scriptsByUrl: Map<string, WebKitProtocol.Debugger.Script>;

    private _setBreakpointsRequestQ: Promise<any>;

    public constructor() {
        this._variableHandles = new Handles<string>();
        this._overlayHelper = new Utilities.DebounceHelper(/*timeoutMs=*/200);

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

    public registerEventHandler(eventHandler: (event: DebugProtocol.Event) => void): void {
        this._eventHandler = eventHandler;
    }

    public initialize(args: IInitializeRequestArgs): Promise<void> {
        this._clientLinesStartAt1 = args.linesStartAt1;
        if (args.sourceMaps) {
            this._sourceMaps = new SourceMaps(args.generatedCodeDirectory);
		}

        return Promise.resolve<void>();
    }

    public launch(args: ILaunchRequestArgs): Promise<void> {
        this._clientCWD = args.workingDirectory;
        const chromeExe = args.runtimeExecutable || Utilities.getBrowserPath();

        // Start with remote debugging enabled
        const port = 9222;
        const chromeArgs: string[] = ['--remote-debugging-port=' + port];

        // Also start with extra stuff disabled, and no user-data-dir so previously open tabs aren't opened.
        chromeArgs.push(...['--no-first-run', '--no-default-browser-check']);
        if (args.runtimeArguments) {
            chromeArgs.push(...args.runtimeArguments);
        }

        if (args.program) {
            // Can html files be sourcemapped? May as well try.
            if (this._sourceMaps) {
                const generatedPath = this._sourceMaps.MapPathFromSource(args.program);
                if (generatedPath) {
                    args.program = generatedPath;
                }
            }

            chromeArgs.push(args.program);
        } else if (args.url) {
            chromeArgs.push(args.url);
        }

        if (args.arguments) {
            chromeArgs.push(...args.arguments);
        }

        console.log(`Spawning chrome: "${chromeExe}", ${JSON.stringify(chromeArgs)}`);
        this._chromeProc = spawn(chromeExe, chromeArgs);
        this._chromeProc.on('error', (err) => {
            console.error('chrome error: ' + err);
            this.terminateSession();
        });

        return this._attach(port);
    }

    private _attach(port: number): Promise<void> {
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
                    () => this._eventHandler(new InitializedEvent()),
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
            this._eventHandler(new TerminatedEvent());
        }

        this.clearEverything();
    }

    private clearEverything(): void {
        this.clearClientContext();
        this.clearTargetContext();
        this._chromeProc = null;

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
        this._overlayHelper.doAndCancel(() => this._webKitConnection.page_setOverlayMessage(WebKitDebugAdapter.PAGE_PAUSE_MESSAGE));
        this._currentStack = notification.callFrames;
        const exceptionText = notification.reason === 'exception' ? notification.data.description : undefined;
        this._eventHandler(new StoppedEvent('pause', /*threadId=*/WebKitDebugAdapter.THREAD_ID, exceptionText));
    }

    private onDebuggerResumed(): void {
        // Called when the resume button on the page is pressed, but ODP doesn't have an event to support it.
        this._overlayHelper.wait(() => this._webKitConnection.page_clearOverlayMessage());
        this._currentStack = null;
    }

    private onScriptParsed(script: WebKitProtocol.Debugger.Script): void {
        const clientUrl = this.webkitUrlToClientUrl(script.url);
        this._scriptsByUrl.set(clientUrl, script);
        this._scriptsById.set(script.scriptId, script);

        if (this._pendingBreakpointsByUrl.has(clientUrl)) {
            const pendingBreakpoint = this._pendingBreakpointsByUrl.get(clientUrl);
            this._pendingBreakpointsByUrl.delete(clientUrl);
            // TODO this.setBreakpoints(pendingBreakpoint.response, pendingBreakpoint.args);
        }
    }

    public disconnect(): Promise<void> {
        if (this._chromeProc) {
            this._chromeProc.kill();
            this._chromeProc = null;
        }

        this.clearEverything();

        return Promise.resolve<void>();
    }

    public attach(args: IAttachRequestArgs): Promise<void> {
        if (args.address !== 'localhost') {
            return Promise.reject('Remote debugging is not supported');
        }

        this._attach(args.port);
    }

    public setBreakpoints(args: DebugProtocol.SetBreakpointsArguments): Promise<SetBreakpointsResponseBody> {
        // Do just one setBreakpointsRequest at a time to avoid interleaving breakpoint removed/breakpoint added requests to Chrome
        return this._setBreakpointsRequestQ = this._setBreakpointsRequestQ.then(() => {
            return this._setAllBreakpoints(args);
        });
    }

    private _setAllBreakpoints(args: DebugProtocol.SetBreakpointsArguments): Promise<SetBreakpointsResponseBody> {
        let targetScript: WebKitProtocol.Debugger.Script;
        if (args.source.path) {
            const path = (this._sourceMaps && this._sourceMaps.MapPathFromSource(args.source.path)) || args.source.path;
            const canPath = canonicalizeUrl(path);
            targetScript = this._scriptsByUrl.get(canPath);
        } else if (args.source.sourceReference) {
            targetScript = this._scriptsById.get(sourceReferenceToScriptId(args.source.sourceReference));
        } else if (args.source.name) {
            // ??
        }

        if (targetScript) {
            // ODP sends all current breakpoints for the script. Clear all scripts for the breakpoint then add all of them
            return this.clearAllBreakpoints(targetScript.scriptId)
                .then(() => this._addBreakpoints(args.source.path, targetScript.scriptId, args.lines))
                .then(responses => {
                    return { breakpoints: this._webkitBreakpointResponsesToODPBreakpoints(targetScript, responses) };
                });
        } else {
            // We could set breakpoints by URL here. But ODP doesn't give any way to set the position of that breakpoint when it does resolve later.
            // This seems easier
            // TODO caching by source.path seems wrong because it may not exist? But this implies that we haven't told ODP about this script so it may have to be set. Assert non-null?
            return new Promise((resolve: (response: SetBreakpointsResponseBody) => void, reject) => {
                this._pendingBreakpointsByUrl.set(canonicalizeUrl(args.source.path), { resolve, reject, args });
            })
        }
    }

    private _addBreakpoints(sourcePath: string, scriptId: WebKitProtocol.Debugger.ScriptId, lines: number[]): Promise<WebKitProtocol.Debugger.SetBreakpointResponse[]> {
        // Adjust lines for sourcemaps, call setBreakpoint for all breakpoints in the script simultaneously
        const responsePs = lines
            .map(debuggerLine => {
                // Sourcemap lines
                if (this._sourceMaps) {
                    const mapped = this._sourceMaps.MapFromSource(sourcePath, debuggerLine, /*column=*/0);
                    return mapped ? mapped.line : debuggerLine;
                } else {
                    return debuggerLine;
                }
            })
            .map(lineNumber => this._webKitConnection.debugger_setBreakpoint({ scriptId: scriptId, lineNumber }));

        // Join all setBreakpoint requests to a single promise
        return Promise.all(responsePs);
    }

    private _webkitBreakpointResponsesToODPBreakpoints(script: WebKitProtocol.Debugger.Script, responses: WebKitProtocol.Debugger.SetBreakpointResponse[]): DebugProtocol.Breakpoint[] {
        // Ignore errors
        const successfulResponses = responses
            .filter(response => !response.error);

        // Cache breakpoint ids from webkit in committedBreakpoints set
        this._committedBreakpointsByScriptId.set(script.scriptId, successfulResponses.map(response => response.result.breakpointId));

        // Map committed breakpoints to ODP response breakpoints
        return successfulResponses
            .map(response => {
                let line = response.result.actualLocation.lineNumber;
                if (this._sourceMaps) {
                    const clientUrl = this.webkitUrlToClientUrl(script.url);
                    const mapped = this._sourceMaps.MapToSource(clientUrl, response.result.actualLocation.lineNumber, response.result.actualLocation.columnNumber);
                    if (mapped) {
                        line = mapped.line;
                    }
                }

                return <DebugProtocol.Breakpoint>{
                    verified: true,
                    line: line
                }
            });
    }

    public setExceptionBreakpoints(args: DebugProtocol.SetExceptionBreakpointsArguments): Promise<void> {
        let state: string;
        if (args.filters.indexOf("all") >= 0) {
            state = "all";
        } else if (args.filters.indexOf("uncaught") >= 0) {
            state = "uncaught";
        } else {
            state = "none";
        }

        return this._webKitConnection.debugger_setPauseOnExceptions(state)
            .then(() => { });
    }

    public continue(): Promise<void> {
        return this._webKitConnection.debugger_resume()
            .then(() => { });
    }

    public next(): Promise<void> {
        return this._webKitConnection.debugger_stepOver()
            .then(() => { });
    }

    public stepIn(): Promise<void> {
        return this._webKitConnection.debugger_stepIn()
            .then(() => { });
    }

    public stepOut(): Promise<void> {
        return this._webKitConnection.debugger_stepOut()
            .then(() => { });
    }

    public pause(): Promise<void> {
        return this._webKitConnection.debugger_pause()
            .then(() => { });
    }

    public stackTrace(args: DebugProtocol.StackTraceArguments): Promise<StackTraceResponseBody> {
        const stackFrames: DebugProtocol.StackFrame[] = this._currentStack.map((callFrame: WebKitProtocol.Debugger.CallFrame, i: number) => {
            const script = this._scriptsById.get(callFrame.location.scriptId);
            let path = this.webkitUrlToClientUrl(script.url);
            let line = callFrame.location.lineNumber;
            let column = callFrame.location.columnNumber;
            if (this._sourceMaps) {
                const mapped = this._sourceMaps.MapToSource(path, line, column);
                if (mapped) {
                    path = mapped.path;
                    line = mapped.line;
                    column = mapped.column;
                }
            }

            const source = <DebugProtocol.Source>{
                path,
                sourceReference: scriptIdToSourceReference(script.scriptId)
            };

            return {
                id: i,
                name: callFrame.functionName || '(eval code)', // anything else?
                source,
                line: line,
                column
            };
        });

        return Promise.resolve({ stackFrames });
    }

    public scopes(args: DebugProtocol.ScopesArguments): Promise<ScopesResponseBody> {
        const scopes = this._currentStack[args.frameId].scopeChain.map((scope: WebKitProtocol.Debugger.Scope) => {
            return <DebugProtocol.Scope>{
                name: scope.type,
                variablesReference: this._variableHandles.create(scope.object.objectId),
                expensive: true // ?
            };
        });

        return Promise.resolve({ scopes });
    }

    public variables(args: DebugProtocol.VariablesArguments): Promise<VariablesResponseBody> {
        const id = this._variableHandles.get(args.variablesReference);
        if (id != null) {
            return this._webKitConnection.runtime_getProperties(id, /*ownProperties=*/true).then(getPropsResponse => {
                const variables = getPropsResponse.error ? [] :
                    getPropsResponse.result.result.map(propDesc => this.propertyDescriptorToODPVariable(propDesc));

                return { variables };
            });
        } else {
            return Promise.resolve<VariablesResponseBody>();
        }
    }

    public source(args: DebugProtocol.SourceArguments): Promise<SourceResponseBody> {
        return this._webKitConnection.debugger_getScriptSource(sourceReferenceToScriptId(args.sourceReference)).then(webkitResponse => {
            return { content: webkitResponse.result.scriptSource };
        });
    }

    public threads(): Promise<ThreadsResponseBody> {
        return Promise.resolve({
            threads: [
                {
                    id: WebKitDebugAdapter.THREAD_ID,
                    name: 'Thread ' + WebKitDebugAdapter.THREAD_ID
                }
            ]
        });
    }

    public evaluate(args: DebugProtocol.EvaluateArguments): Promise<EvaluateResponseBody> {
        let evalPromise: Promise<any>;
        if (this.paused) {
            const callFrameId = this._currentStack[args.frameId].callFrameId;
            evalPromise = this._webKitConnection.debugger_evaluateOnCallFrame(callFrameId, args.expression);
        } else {
            evalPromise = this._webKitConnection.runtime_evaluate(args.expression);
        }

        return evalPromise.then(evalResponse => {
            const resultObj: WebKitProtocol.Runtime.RemoteObject = evalResponse.result.result;
            let result: string;
            let variablesReference = 0;
            if (evalResponse.result.wasThrown) {
                return Promise.reject(evalResponse.result.exceptionDetails.text);
            } else if (resultObj.type === 'object') {
                result = 'Object';
                variablesReference = this._variableHandles.create(resultObj.objectId);
            } else if (resultObj.type === 'undefined') {
                result = 'undefined';
            } else {
                // The result was a primitive value, or something which has a description (not object, primitive, or undefined)
                result = '' + (typeof resultObj.value === 'undefined' ? resultObj.description : resultObj.value);
            }

            return { result, variablesReference };
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
        const committedBps = this._committedBreakpointsByScriptId.get(scriptId) || [];

        // Remove breakpoints one at a time. Seems like it would be ok to send the removes all at once,
        // but there is a chrome bug where when removing 5+ or so breakpoints at once, it gets into a weird
        // state where later adds on the same line will fail with "breakpoint already exists" even though it
        // does not break there.
        return committedBps.reduce<Promise<void>>((p, bpId) => {
            return p.then(() => this._webKitConnection.debugger_removeBreakpoint(bpId)).then(() => { });
        }, Promise.resolve<void>());
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
        const pathName = nodeUrl.parse(canonicalizeUrl(url)).pathname;
        if (!pathName) {
            return '';
        }

        const pathParts = pathName.split('/');
        while (pathParts.length > 0) {
            const rootDir = this._sourceMaps ? this._sourceMaps['outDir'] : this._clientCWD;
            const clientUrl = path.join(rootDir, pathParts.join('/'));
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
 * file:///Users/me/project/code.js => /Users/me/project/code.js
 */
function canonicalizeUrl(url: string): string {
    url = url
        .replace('file:///', '')
        .replace(/\\/g, '/'); // \ to /

    // Ensure osx path starts with /, it can be removed when file:/// was stripped
    if (url[0] !== '/' && Utilities.getPlatform() === Utilities.Platform.OSX) {
        url = '/' + url;
    }

    // VS Code gives a lowercase drive letter
    if (url.match(/^[A-Z]:\//) && Utilities.getPlatform() === Utilities.Platform.Windows) {
        url = url[0].toLowerCase() + url.substr(1);
    }

    return url;
}

function scriptIdToSourceReference(scriptId: WebKitProtocol.Debugger.ScriptId): number {
    return parseInt(scriptId);
}

function sourceReferenceToScriptId(sourceReference: number): WebKitProtocol.Debugger.ScriptId {
    return '' + sourceReference;
}
