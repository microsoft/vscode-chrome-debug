/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

/**
 * This file contains extended forms of interfaces from vscode-debugprotocol
 */

import {DebugProtocol} from 'vscode-debugprotocol';

export type ISourceMapPathOverrides = { [pattern: string]: string };

/**
 * Properties valid for both Launch and Attach
 */
export interface CommonRequestArgs {
    webRoot?: string;
    outDir?: string;
    outFiles?: string[];
    sourceMaps?: boolean;
    diagnosticLogging?: boolean;
    verboseDiagnosticLogging?: boolean;
    sourceMapPathOverrides?: ISourceMapPathOverrides;
}

/**
 * Properties needed by -core, just a subset of the properties needed for launch in general
 */
export interface ILaunchRequestArgs extends DebugProtocol.LaunchRequestArguments, CommonRequestArgs {
    userDataDir?: string;
}

export interface IAttachRequestArgs extends DebugProtocol.AttachRequestArguments, CommonRequestArgs {
    port: number;
    url?: string;
    address?: string;
    remoteRoot?: string;
    localRoot?: string;
}

export interface ISetBreakpointsArgs extends DebugProtocol.SetBreakpointsArguments {
    /** DebugProtocol does not send cols, maybe it will someday, but this is used internally when a location is sourcemapped */
    cols?: number[];
    authoredPath?: string;
}

/*
 * The ResponseBody interfaces are copied from debugProtocol.d.ts which defines these inline in the Response interfaces.
 * They should always match those interfaces, see the original for comments.
 */
export interface ISetBreakpointsResponseBody {
    breakpoints: DebugProtocol.Breakpoint[];
}

export interface ISourceResponseBody {
    content: string;
    mimeType?: string;
}

export interface IThreadsResponseBody {
    threads: DebugProtocol.Thread[];
}

export interface IStackTraceResponseBody {
    stackFrames: DebugProtocol.StackFrame[];
}

export interface IScopesResponseBody {
    scopes: DebugProtocol.Scope[];
}

export interface IVariablesResponseBody {
    variables: DebugProtocol.Variable[];
}

export interface IEvaluateResponseBody {
    result: string;
    type?: string;
    variablesReference: number;
    namedVariables?: number;
    indexedVariables?: number;
}

export interface ISetVariableResponseBody {
    value: string;
}

declare type PromiseOrNot<T> = T | Promise<T>;

/**
 * All methods returning PromiseOrNot can either return a Promise or a value, and if they reject the Promise, it can be with an Error or a
 * DebugProtocol.Message object, which will be sent to sendErrorResponse.
 */
export interface IDebugAdapter {
    // From DebugSession
    shutdown(): void;

    initialize(args: DebugProtocol.InitializeRequestArguments, requestSeq?: number): PromiseOrNot<DebugProtocol.Capabilities>;
    launch(args: ILaunchRequestArgs, requestSeq?: number): PromiseOrNot<void>;
    attach(args: IAttachRequestArgs, requestSeq?: number): PromiseOrNot<void>;
    disconnect(): PromiseOrNot<void>;
    setBreakpoints(args: DebugProtocol.SetBreakpointsArguments, requestSeq?: number): PromiseOrNot<ISetBreakpointsResponseBody>;
    setExceptionBreakpoints(args: DebugProtocol.SetExceptionBreakpointsArguments, requestSeq?: number): PromiseOrNot<void>;
    configurationDone(): PromiseOrNot<void>;

    continue(): PromiseOrNot<void>;
    next(): PromiseOrNot<void>;
    stepIn(): PromiseOrNot<void>;
    stepOut(): PromiseOrNot<void>;
    pause(): PromiseOrNot<void>;

    stackTrace(args: DebugProtocol.StackTraceArguments, requestSeq?: number): PromiseOrNot<IStackTraceResponseBody>;
    scopes(args: DebugProtocol.ScopesArguments, requestSeq?: number): PromiseOrNot<IScopesResponseBody>;
    variables(args: DebugProtocol.VariablesArguments, requestSeq?: number): PromiseOrNot<IVariablesResponseBody>;
    source(args: DebugProtocol.SourceArguments, requestSeq?: number): PromiseOrNot<ISourceResponseBody>;
    threads(): PromiseOrNot<IThreadsResponseBody>;
    evaluate(args: DebugProtocol.EvaluateArguments, requestSeq?: number): PromiseOrNot<IEvaluateResponseBody>;
}

export interface IDebugTransformer {
    initialize?(args: DebugProtocol.InitializeRequestArguments, requestSeq?: number): PromiseOrNot<void>;
    launch?(args: ILaunchRequestArgs, requestSeq?: number): PromiseOrNot<void>;
    attach?(args: IAttachRequestArgs, requestSeq?: number): PromiseOrNot<void>;
    setBreakpoints?(args: DebugProtocol.SetBreakpointsArguments, requestSeq?: number): PromiseOrNot<void>;
    setExceptionBreakpoints?(args: DebugProtocol.SetExceptionBreakpointsArguments, requestSeq?: number): PromiseOrNot<void>;

    stackTrace?(args: DebugProtocol.StackTraceArguments, requestSeq?: number): PromiseOrNot<void>;
    scopes?(args: DebugProtocol.ScopesArguments, requestSeq?: number): PromiseOrNot<void>;
    variables?(args: DebugProtocol.VariablesArguments, requestSeq?: number): PromiseOrNot<void>;
    source?(args: DebugProtocol.SourceArguments, requestSeq?: number): PromiseOrNot<void>;
    evaluate?(args: DebugProtocol.EvaluateArguments, requestSeq?: number): PromiseOrNot<void>;

    setBreakpointsResponse?(response: ISetBreakpointsResponseBody, requestSeq?: number): PromiseOrNot<void>;
    stackTraceResponse?(response: IStackTraceResponseBody, requestSeq?: number): PromiseOrNot<void>;
    scopesResponse?(response: IScopesResponseBody, requestSeq?: number): PromiseOrNot<void>;
    variablesResponse?(response: IVariablesResponseBody, requestSeq?: number): PromiseOrNot<void>;
    sourceResponse?(response: ISourceResponseBody, requestSeq?: number): PromiseOrNot<void>;
    threadsResponse?(response: IThreadsResponseBody, requestSeq?: number): PromiseOrNot<void>;
    evaluateResponse?(response: IEvaluateResponseBody, requestSeq?: number): PromiseOrNot<void>;

    scriptParsed?(event: DebugProtocol.Event);
}
