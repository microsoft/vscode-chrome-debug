interface IInitializeRequestArgs extends DebugProtocol.InitializeRequestArguments {
    sourceMaps?: boolean;
    generatedCodeDirectory?: string;
}

interface ILaunchRequestArgs extends DebugProtocol.LaunchRequestArguments {
    workingDirectory: string;
    runtimeArguments?: string[];
    runtimeExecutable?: string;
    program?: string;
    url?: string;
    arguments?: string[];
    stopOnEntry?: boolean;
}

interface IAttachRequestArgs extends DebugProtocol.AttachRequestArguments {
    port: number;
    address: string;
}

/*
 * The ResponseBody interfaces are copied from debugProtocol.d.ts which defines these inline in the Response interfaces.
 * They should always match those interfaces, see the original for comments.
 */
interface SetBreakpointsResponseBody {
    breakpoints: DebugProtocol.Breakpoint[];
}

interface SourceResponseBody {
    content: string;
}

interface ThreadsResponseBody {
    threads: DebugProtocol.Thread[];
}

interface StackTraceResponseBody {
    stackFrames: DebugProtocol.StackFrame[];
}

interface ScopesResponseBody {
    scopes: DebugProtocol.Scope[];
}

interface VariablesResponseBody {
    variables: DebugProtocol.Variable[];
}

interface EvaluateResponseBody {
    result: string;
    variablesReference: number;
}

interface IDebugAdapter {
    registerEventHandler(eventHandler: (event: DebugProtocol.Event) => void): void;

    initialize(args: IInitializeRequestArgs): Promise<void>;
    launch(args: ILaunchRequestArgs): Promise<void>;
    disconnect(): Promise<void>;
    attach(args: IAttachRequestArgs): Promise<void>;
    setBreakpoints(args: DebugProtocol.SetBreakpointsArguments): Promise<SetBreakpointsResponseBody>;
    setExceptionBreakpoints(args: DebugProtocol.SetExceptionBreakpointsArguments): Promise<void>;

    continue(): Promise<void>;
    next(): Promise<void>;
    stepIn(): Promise<void>;
    stepOut(): Promise<void>;
    pause(): Promise<void>;

    stackTrace(args: DebugProtocol.StackTraceArguments): Promise<StackTraceResponseBody>;
    scopes(args: DebugProtocol.ScopesArguments): Promise<ScopesResponseBody>;
    variables(args: DebugProtocol.VariablesArguments): Promise<VariablesResponseBody>;
    source(args: DebugProtocol.SourceArguments): Promise<SourceResponseBody>;
    threads(): Promise<ThreadsResponseBody>;
    evaluate(args: DebugProtocol.EvaluateArguments): Promise<EvaluateResponseBody>;
}

declare type PromiseOrNot<T> = T | Promise<T>;
interface IDebugTransformer {
    initialize?(args: IInitializeRequestArgs, requestSeq?: number): PromiseOrNot<void>;
    launch?(args: ILaunchRequestArgs, requestSeq?: number): PromiseOrNot<void>;
    attach?(args: IAttachRequestArgs, requestSeq?: number): PromiseOrNot<void>;
    setBreakpoints?(args: DebugProtocol.SetBreakpointsArguments, requestSeq?: number): PromiseOrNot<void>;
    setExceptionBreakpoints?(args: DebugProtocol.SetExceptionBreakpointsArguments, requestSeq?: number): PromiseOrNot<void>;

    stackTrace?(args: DebugProtocol.StackTraceArguments, requestSeq?: number): PromiseOrNot<void>;
    scopes?(args: DebugProtocol.ScopesArguments, requestSeq?: number): PromiseOrNot<void>;
    variables?(args: DebugProtocol.VariablesArguments, requestSeq?: number): PromiseOrNot<void>;
    source?(args: DebugProtocol.SourceArguments, requestSeq?: number): PromiseOrNot<void>;
    evaluate?(args: DebugProtocol.EvaluateArguments, requestSeq?: number): PromiseOrNot<void>;

    setBreakpointsResponse?(response: SetBreakpointsResponseBody, requestSeq?: number): PromiseOrNot<void>;
    stackTraceResponse?(response: StackTraceResponseBody, requestSeq?: number): PromiseOrNot<void>;
    scopesResponse?(response: ScopesResponseBody, requestSeq?: number): PromiseOrNot<void>;
    variablesResponse?(response: VariablesResponseBody, requestSeq?: number): PromiseOrNot<void>;
    sourceResponse?(response: SourceResponseBody, requestSeq?: number): PromiseOrNot<void>;
    threadsResponse?(response: ThreadsResponseBody, requestSeq?: number): PromiseOrNot<void>;
    evaluateResponse?(response: EvaluateResponseBody, requestSeq?: number): PromiseOrNot<void>;
}
