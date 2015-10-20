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
    initialize?(args: IInitializeRequestArgs): PromiseOrNot<void>;
    launch?(args: ILaunchRequestArgs): PromiseOrNot<void>;
    attach?(args: IAttachRequestArgs): PromiseOrNot<void>;
    setBreakpoints?(args: DebugProtocol.SetBreakpointsArguments): PromiseOrNot<void>;
    setExceptionBreakpoints?(args: DebugProtocol.SetExceptionBreakpointsArguments): PromiseOrNot<void>;

    stackTrace?(args: DebugProtocol.StackTraceArguments): PromiseOrNot<void>;
    scopes?(args: DebugProtocol.ScopesArguments): PromiseOrNot<void>;
    variables?(args: DebugProtocol.VariablesArguments): PromiseOrNot<void>;
    source?(args: DebugProtocol.SourceArguments): PromiseOrNot<void>;
    evaluate?(args: DebugProtocol.EvaluateArguments): PromiseOrNot<void>;

    setBreakpointsResponse?(response: SetBreakpointsResponseBody): PromiseOrNot<void>;
    stackTraceResponse?(response: StackTraceResponseBody): PromiseOrNot<void>;
    scopesResponse?(response: ScopesResponseBody): PromiseOrNot<void>;
    variablesResponse?(response: VariablesResponseBody): PromiseOrNot<void>;
    sourceResponse?(response: SourceResponseBody): PromiseOrNot<void>;
    threadsResponse?(response: ThreadsResponseBody): PromiseOrNot<void>;
    evaluateResponse?(response: EvaluateResponseBody): PromiseOrNot<void>;
}
