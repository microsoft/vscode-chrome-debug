/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {Event} from '../common/v8Protocol';
import {StoppedEvent, InitializedEvent, TerminatedEvent, OutputEvent} from '../common/debugSession';
import {Handles} from '../common/handles';
import {WebKitConnection} from './webKitConnection';
import * as Utilities from './utilities';
import {Logger} from './utilities';
import {formatConsoleMessage} from './consoleHelper';

import {spawn, ChildProcess} from 'child_process';
import * as path from 'path';
import * as os from 'os';

export class WebKitDebugAdapter implements IDebugAdapter {
    private static THREAD_ID = 1;
    private static PAGE_PAUSE_MESSAGE = 'Paused in Visual Studio Code';

    private _clientLinesStartAt1: boolean;

    private _clientAttached: boolean;
    private _variableHandles: Handles<string>;
    private _currentStack: WebKitProtocol.Debugger.CallFrame[];
    private _committedBreakpointsByUrl: Map<string, WebKitProtocol.Debugger.BreakpointId[]>;
    private _overlayHelper: Utilities.DebounceHelper;

    private _chromeProc: ChildProcess;
    private _webKitConnection: WebKitConnection;
    private _eventHandler: (event: DebugProtocol.Event) => void;

    // Scripts
    private _scriptsById: Map<WebKitProtocol.Debugger.ScriptId, WebKitProtocol.Debugger.Script>;

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
        this._committedBreakpointsByUrl = new Map<string, WebKitProtocol.Debugger.BreakpointId[]>();
        this._setBreakpointsRequestQ = Promise.resolve<void>();
        this.fireEvent(new Event('clearTargetContext'));
    }

    private clearClientContext(): void {
        Logger.disableDiagnosticLogging();
        this._clientAttached = false;
        this.fireEvent(new Event('clearClientContext'));
    }

    public registerEventHandler(eventHandler: (event: DebugProtocol.Event) => void): void {
        this._eventHandler = eventHandler;
    }

    public initialize(args: DebugProtocol.InitializeRequestArguments): void {
        this._clientLinesStartAt1 = args.linesStartAt1;
    }

    public launch(args: ILaunchRequestArgs): Promise<void> {
        if (args.diagnosticLogging) {
            this.setupDiagnosticLogging();
        }

        // Check exists?
        const chromePath = args.runtimeExecutable || Utilities.getBrowserPath();
        if (!chromePath) {
            return Promise.reject(`Can't find Chrome - install it or set the "runtimeExecutable" field in the launch config.`);
        }

        // Start with remote debugging enabled
        const port = args.port || 9222;
        const chromeArgs: string[] = ['--remote-debugging-port=' + port];

        // Also start with extra stuff disabled, and user-data-dir in tmp directory
        chromeArgs.push(...['--no-first-run', '--no-default-browser-check', `--user-data-dir=${os.tmpdir() }/webkitdebugadapter${Date.now() }`]);
        if (args.runtimeArguments) {
            chromeArgs.push(...args.runtimeArguments);
        }

        if (args.file) {
            chromeArgs.push(path.resolve(args.cwd, args.file));
        } else if (args.url) {
            chromeArgs.push(args.url);
        } else {
            return Promise.reject('The launch config must specify either the "file" or "url" field.');
        }

        Logger.log(`spawn('${chromePath}', ${JSON.stringify(chromeArgs) })`);
        this._chromeProc = spawn(chromePath, chromeArgs);
        this._chromeProc.on('error', (err) => {
            Logger.log('chrome error: ' + err);
            this.terminateSession();
        });

        return this._attach(port);
    }

    public attach(args: IAttachRequestArgs): Promise<void> {
        if (args.address !== 'localhost' && args.address !== '127.0.0.1') {
            return Promise.reject('Remote debugging is not supported');
        }

        if (args.port == null) {
            return Promise.reject('The "port" field is required in the attach config.');
        }

        if (args.diagnosticLogging) {
            this.setupDiagnosticLogging();
        }

        return this._attach(args.port);
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
            this._webKitConnection.on('Debugger.breakpointResolved', params => this.onBreakpointResolved(params));

            this._webKitConnection.on('Console.messageAdded', params => this.onConsoleMessage(params));

            this._webKitConnection.on('Inspector.detached', () => this.terminateSession());
            this._webKitConnection.on('close', () => this.terminateSession());
            this._webKitConnection.on('error', () => this.terminateSession());

            return this._webKitConnection.attach(port)
                .then(
                () => this.fireEvent(new InitializedEvent()),
                e => {
                    this.clearEverything();
                    return Promise.reject(e);
                });
        } else {
            return Promise.resolve<void>();
        }
    }

    private setupDiagnosticLogging(): void {
        Logger.enableDiagnosticLogging(msg => this.fireEvent(new OutputEvent(` › ${msg}\n`)));
    }

    private fireEvent(event: DebugProtocol.Event): void {
        if (this._eventHandler) {
            this._eventHandler(event);
        }
    }

    /**
     * Chrome is closing, or error'd somehow, stop the debug session
     */
    private terminateSession(): void {
        if (this._clientAttached) {
            this.fireEvent(new TerminatedEvent());
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

    private onDebuggerPaused(notification: WebKitProtocol.Debugger.PausedParams): void {
        this._overlayHelper.doAndCancel(() => this._webKitConnection.page_setOverlayMessage(WebKitDebugAdapter.PAGE_PAUSE_MESSAGE));
        this._currentStack = notification.callFrames;

        // We can tell when we've broken on an exception. Otherwise if hitBreakpoints is set, assume we hit a
        // breakpoint. If not set, assume it was a step. We can't tell the difference between step and 'break on anything'.
        let reason: string;
        let exceptionText: string;
        if (notification.reason === 'exception') {
            reason = 'exception';
            exceptionText = notification.data.description;
            if (notification.data && notification.data.objectId && this._currentStack.length) {
                // Insert a scope to wrap the exception object. exceptionText is unused at the moment
                this._currentStack[0].scopeChain.unshift({ type: 'Exception', object: notification.data });
            }
        } else {
            reason = notification.hitBreakpoints.length ? 'breakpoint' : 'step';
        }

        this.fireEvent(new StoppedEvent(reason, /*threadId=*/WebKitDebugAdapter.THREAD_ID, exceptionText));
    }

    private onDebuggerResumed(): void {
        this._overlayHelper.wait(() => this._webKitConnection.page_clearOverlayMessage());
        this._currentStack = null;

        // This is a private undocumented event provided by VS Code to support the 'continue' button on a paused Chrome page
        let resumedEvent = new Event('continued', { threadId: WebKitDebugAdapter.THREAD_ID });
        this.fireEvent(resumedEvent);
    }

    private onScriptParsed(script: WebKitProtocol.Debugger.Script): void {
        this._scriptsById.set(script.scriptId, script);
        this.fireEvent(new Event('scriptParsed', { scriptUrl: script.url }));
    }

    private onBreakpointResolved(params: WebKitProtocol.Debugger.BreakpointResolvedParams): void {
        const script = this._scriptsById.get(params.location.scriptId);
        if (!script) {
            // Breakpoint resolved for a script we don't know about
            return;
        }

        const committedBps = this._committedBreakpointsByUrl.get(script.url) || [];
        committedBps.push(params.breakpointId);
        this._committedBreakpointsByUrl.set(script.url, committedBps);
    }

    private onConsoleMessage(params: WebKitProtocol.Console.MessageAddedParams): void {
        const formattedMessage = formatConsoleMessage(params.message);
        if (formattedMessage) {
            this.fireEvent(new OutputEvent(
                formattedMessage.text + '\n',
                formattedMessage.isError ? 'stderr' : 'stdout'));
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

    public setBreakpoints(args: ISetBreakpointsArgs): Promise<SetBreakpointsResponseBody> {
        let targetScriptUrl: string;
        if (args.source.path) {
            targetScriptUrl = args.source.path;
        } else if (args.source.sourceReference) {
            const targetScript = this._scriptsById.get(sourceReferenceToScriptId(args.source.sourceReference));
            if (targetScript) {
                targetScriptUrl = targetScript.url;
            }
        }

        if (targetScriptUrl) {
            // DebugProtocol sends all current breakpoints for the script. Clear all scripts for the breakpoint then add all of them
            const setBreakpointsPFailOnError = this._setBreakpointsRequestQ
                .then(() => this._clearAllBreakpoints(targetScriptUrl))
                .then(() => this._addBreakpoints(targetScriptUrl, args.lines, args.cols))
                .then(responses => ({ breakpoints: this._webkitBreakpointResponsesToODPBreakpoints(targetScriptUrl, responses, args.lines) }));

            const setBreakpointsPTimeout = Utilities.promiseTimeout(setBreakpointsPFailOnError, /*timeoutMs*/2000, 'Set breakpoints request timed out');

            // Do just one setBreakpointsRequest at a time to avoid interleaving breakpoint removed/breakpoint added requests to Chrome.
            // Swallow errors in the promise queue chain so it doesn't get blocked, but return the failing promise for error handling.
            this._setBreakpointsRequestQ = setBreakpointsPTimeout.catch(() => undefined);
            return setBreakpointsPTimeout;
        } else {
            return Promise.reject(`Can't find script for breakpoint request`);
        }
    }

    private _clearAllBreakpoints(url: string): Promise<void> {
        if (!this._committedBreakpointsByUrl.has(url)) {
            return Promise.resolve<void>();
        }

        // Remove breakpoints one at a time. Seems like it would be ok to send the removes all at once,
        // but there is a chrome bug where when removing 5+ or so breakpoints at once, it gets into a weird
        // state where later adds on the same line will fail with 'breakpoint already exists' even though it
        // does not break there.
        return this._committedBreakpointsByUrl.get(url).reduce((p, bpId) => {
            return p.then(() => this._webKitConnection.debugger_removeBreakpoint(bpId)).then(() => { });
        }, Promise.resolve<void>()).then(() => {
            this._committedBreakpointsByUrl.set(url, null);
        });
    }

    private _addBreakpoints(url: string, lines: number[], cols?: number[]): Promise<WebKitProtocol.Debugger.SetBreakpointByUrlResponse[]> {
        // Call setBreakpoint for all breakpoints in the script simultaneously
        const responsePs = lines
            .map((lineNumber, i) => this._webKitConnection.debugger_setBreakpointByUrl(url, lineNumber, cols ? cols[i] : 0));

        // Join all setBreakpoint requests to a single promise
        return Promise.all(responsePs);
    }

    private _webkitBreakpointResponsesToODPBreakpoints(url: string, responses: WebKitProtocol.Debugger.SetBreakpointByUrlResponse[], requestLines: number[]): DebugProtocol.Breakpoint[] {
        // Don't cache errored responses
        const committedBpIds = responses
            .filter(response => !response.error)
            .map(response => response.result.breakpointId);

        // Cache successfully set breakpoint ids from webkit in committedBreakpoints set
        this._committedBreakpointsByUrl.set(url, committedBpIds);

        // Map committed breakpoints to DebugProtocol response breakpoints
        const bps = responses
            .map((response, i) => {
                // The output list needs to be the same length as the input list, so map errors to
                // unverified breakpoints.
                if (response.error || !response.result.locations.length) {
                    return <DebugProtocol.Breakpoint>{
                        verified: false,
                        line: requestLines[i],
                        column: 0
                    };
                }

                return <DebugProtocol.Breakpoint>{
                    verified: true,
                    line: response.result.locations[0].lineNumber,
                    column: response.result.locations[0].columnNumber
                };
            });

        return bps;
    }

    public setExceptionBreakpoints(args: DebugProtocol.SetExceptionBreakpointsArguments): Promise<void> {
        let state: string;
        if (args.filters.indexOf('all') >= 0) {
            state = 'all';
        } else if (args.filters.indexOf('uncaught') >= 0) {
            state = 'uncaught';
        } else {
            state = 'none';
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

    public stackTrace(args: DebugProtocol.StackTraceArguments): StackTraceResponseBody {
        // Only process at the requested number of frames, if 'levels' is specified
        let stack = this._currentStack;
        if (args.levels) {
            stack = this._currentStack.filter((_, i) => i < args.levels);
        }

        const stackFrames: DebugProtocol.StackFrame[] = stack
            .map((callFrame: WebKitProtocol.Debugger.CallFrame, i: number) => {
                const script = this._scriptsById.get(callFrame.location.scriptId);
                const line = callFrame.location.lineNumber;
                const column = callFrame.location.columnNumber;

                // When the script has a url, send the name and path fields.
                // Otherwise, send the name and sourceReference fields
                const source: DebugProtocol.Source =
                    script.url ?
                        {
                            name: path.basename(script.url),
                            path: script.url,
                            sourceReference: 0
                        } :
                        {
                            // Name should be undefined, work around VS Code bug 20274
                            name: 'eval: ' + script.scriptId,
                            sourceReference: scriptIdToSourceReference(script.scriptId)
                        };

                // If the frame doesn't have a function name, it's either an anonymous function
                // or eval script. If its source has a name, it's probably an anonymous function.
                const frameName = callFrame.functionName || (script.url ? '(anonymous function)' : '(eval code)');
                return {
                    id: i,
                    name: frameName,
                    source,
                    line: line,
                    column
                };
            });

        return { stackFrames };
    }

    public scopes(args: DebugProtocol.ScopesArguments): ScopesResponseBody {
        const scopes = this._currentStack[args.frameId].scopeChain.map((scope: WebKitProtocol.Debugger.Scope) => {
            return <DebugProtocol.Scope>{
                name: scope.type,
                variablesReference: this._variableHandles.create(scope.object.objectId),
                expensive: scope.type === 'global'
            };
        });

        return { scopes };
    }

    public variables(args: DebugProtocol.VariablesArguments): Promise<VariablesResponseBody> {
        const id = this._variableHandles.get(args.variablesReference);
        if (id != null) {
            return this._webKitConnection.runtime_getProperties(id, /*ownProperties=*/true).then(getPropsResponse => {
                const variables = getPropsResponse.error ? [] :
                    getPropsResponse.result.result.map(propDesc => this.propertyDescriptorToVariable(propDesc));

                return { variables };
            });
        } else {
            return Promise.resolve();
        }
    }

    public source(args: DebugProtocol.SourceArguments): Promise<SourceResponseBody> {
        return this._webKitConnection.debugger_getScriptSource(sourceReferenceToScriptId(args.sourceReference)).then(webkitResponse => {
            return { content: webkitResponse.result.scriptSource };
        });
    }

    public threads(): ThreadsResponseBody {
        return {
            threads: [
                {
                    id: WebKitDebugAdapter.THREAD_ID,
                    name: 'Thread ' + WebKitDebugAdapter.THREAD_ID
                }
            ]
        };
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
            if (evalResponse.result.wasThrown) {
                const errorMessage = evalResponse.result.exceptionDetails ? evalResponse.result.exceptionDetails.text : 'Error';
                return Promise.reject(errorMessage);
            }

            const { value, variablesReference } = this.remoteObjectToValue(evalResponse.result.result);
            return { result: value, variablesReference };
        });
    }

    private propertyDescriptorToVariable(propDesc: WebKitProtocol.Runtime.PropertyDescriptor): DebugProtocol.Variable {
        if (propDesc.get || propDesc.set) {
            // A property doesn't have a value here, and we shouldn't evaluate the getter because it may have side effects.
            // Node adapter shows 'undefined', Chrome can eval the getter on demand.
            return { name: propDesc.name, value: 'property', variablesReference: 0 };
        } else {
            const { value, variablesReference } = this.remoteObjectToValue(propDesc.value);
            return { name: propDesc.name, value, variablesReference };
        }
    }

    /**
     * Run the object through Utilities.remoteObjectToValue, and if it returns a variableHandle reference,
     * use it with this instance's variableHandles to create a variable handle.
     */
    private remoteObjectToValue(object: WebKitProtocol.Runtime.RemoteObject): { value: string, variablesReference: number } {
        const { value, variableHandleRef } = Utilities.remoteObjectToValue(object);
        const result = { value, variablesReference: 0 };
        if (variableHandleRef) {
            result.variablesReference = this._variableHandles.create(variableHandleRef);
        }

        return result;
    }
}

function scriptIdToSourceReference(scriptId: WebKitProtocol.Debugger.ScriptId): number {
    return parseInt(scriptId, 10);
}

function sourceReferenceToScriptId(sourceReference: number): WebKitProtocol.Debugger.ScriptId {
    return '' + sourceReference;
}
