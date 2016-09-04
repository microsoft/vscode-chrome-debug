/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {DebugProtocol} from 'vscode-debugprotocol';

import {IDebugAdapter, PromiseOrNot, ILaunchRequestArgs, IAttachRequestArgs, ISetBreakpointsResponseBody, IStackTraceResponseBody,
    IScopesResponseBody, IVariablesResponseBody, ISourceResponseBody, IThreadsResponseBody, IEvaluateResponseBody} from './debugAdapterInterfaces';

export abstract class BaseDebugAdapter implements IDebugAdapter {
    private _eventHandler: (event: DebugProtocol.Event) => void;
    private _requestHandler: (command: string, args: any, timeout: number, cb: (response: DebugProtocol.Response) => void) => void;

    public registerEventHandler(eventHandler: (event: DebugProtocol.Event) => void): void {
        this._eventHandler = eventHandler;
    }

    public registerRequestHandler(requestHandler: (command: string, args: any, timeout: number, cb: (response: DebugProtocol.Response) => void) => void): void {
        this._requestHandler = requestHandler;
    }

    protected sendEvent(event: DebugProtocol.Event): void {
        if (this._eventHandler) {
            this._eventHandler(event);
        }
    }

    protected sendRequest(command: string, args: any, timeout: number, cb: (response: DebugProtocol.Response) => void): void {
        if (this._requestHandler) {
            this._requestHandler(command, args, timeout, cb);
        }
    }

    // TS says unimplemented methods need to be here, even in an abstract class
    public abstract initialize(args: DebugProtocol.InitializeRequestArguments, requestSeq?: number): PromiseOrNot<DebugProtocol.Capabilites>;
    public abstract launch(args: ILaunchRequestArgs, requestSeq?: number): PromiseOrNot<void>;
    public abstract disconnect(): PromiseOrNot<void>;
    public abstract attach(args: IAttachRequestArgs, requestSeq?: number): PromiseOrNot<void>;
    public abstract setBreakpoints(args: DebugProtocol.SetBreakpointsArguments, requestSeq?: number): PromiseOrNot<ISetBreakpointsResponseBody>;
    public abstract setExceptionBreakpoints(args: DebugProtocol.SetExceptionBreakpointsArguments, requestSeq?: number): PromiseOrNot<void>;

    public abstract continue(): PromiseOrNot<void>;
    public abstract next(): PromiseOrNot<void>;
    public abstract stepIn(): PromiseOrNot<void>;
    public abstract stepOut(): PromiseOrNot<void>;
    public abstract pause(): PromiseOrNot<void>;

    public abstract stackTrace(args: DebugProtocol.StackTraceArguments, requestSeq?: number): PromiseOrNot<IStackTraceResponseBody>;
    public abstract scopes(args: DebugProtocol.ScopesArguments, requestSeq?: number): PromiseOrNot<IScopesResponseBody>;
    public abstract variables(args: DebugProtocol.VariablesArguments, requestSeq?: number): PromiseOrNot<IVariablesResponseBody>;
    public abstract source(args: DebugProtocol.SourceArguments, requestSeq?: number): PromiseOrNot<ISourceResponseBody>;
    public abstract threads(): PromiseOrNot<IThreadsResponseBody>;
    public abstract evaluate(args: DebugProtocol.EvaluateArguments, requestSeq?: number): PromiseOrNot<IEvaluateResponseBody>;
}