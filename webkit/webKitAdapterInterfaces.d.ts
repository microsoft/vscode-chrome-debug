interface ILaunchRequestArgs extends DebugProtocol.LaunchRequestArguments {
    cwd: string; /* Automatically set by VS Code to the currently opened folder */
    webRoot?: string;
    runtimeArgs?: string[];
    runtimeExecutable?: string;
    file?: string;
    url?: string;
    stopOnEntry?: boolean;
    sourceMaps?: boolean;
    port?: number;
    diagnosticLogging?: boolean;
    userDataDir?: string;
}

interface IAttachRequestArgs extends DebugProtocol.AttachRequestArguments {
    cwd: string; /* Automatically set by VS Code to the currently opened folder */
    webRoot?: string;
    port: number;
    sourceMaps?: boolean;
    diagnosticLogging?: boolean;
}

interface ISetBreakpointsArgs extends DebugProtocol.SetBreakpointsArguments {
    /** DebugProtocol does not send cols, maybe it will someday, but this is used internally when a location is sourcemapped */
    cols?: number[];
    authoredPath?: string;
}

interface IBreakpoint extends DebugProtocol.Breakpoint {
    column?: number;
}

/*
 * The ResponseBody interfaces are copied from debugProtocol.d.ts which defines these inline in the Response interfaces.
 * They should always match those interfaces, see the original for comments.
 */
interface ISetBreakpointsResponseBody {
    breakpoints: IBreakpoint[];
}

interface ISourceResponseBody {
    content: string;
}

interface IThreadsResponseBody {
    threads: DebugProtocol.Thread[];
}

interface IStackTraceResponseBody {
    stackFrames: DebugProtocol.StackFrame[];
}

interface IScopesResponseBody {
    scopes: DebugProtocol.Scope[];
}

interface IVariablesResponseBody {
    variables: DebugProtocol.Variable[];
}

interface IEvaluateResponseBody {
    result: string;
    variablesReference: number;
}

declare type PromiseOrNot<T> = T | Promise<T>;
interface IDebugAdapter {
    registerEventHandler(eventHandler: (event: DebugProtocol.Event) => void): void;

    initialize(args: DebugProtocol.InitializeRequestArguments): PromiseOrNot<void>;
    launch(args: ILaunchRequestArgs): PromiseOrNot<void>;
    disconnect(): PromiseOrNot<void>;
    attach(args: IAttachRequestArgs): PromiseOrNot<void>;
    setBreakpoints(args: DebugProtocol.SetBreakpointsArguments): PromiseOrNot<ISetBreakpointsResponseBody>;
    setExceptionBreakpoints(args: DebugProtocol.SetExceptionBreakpointsArguments): PromiseOrNot<void>;

    continue(): PromiseOrNot<void>;
    next(): PromiseOrNot<void>;
    stepIn(): PromiseOrNot<void>;
    stepOut(): PromiseOrNot<void>;
    pause(): PromiseOrNot<void>;

    stackTrace(args: DebugProtocol.StackTraceArguments): PromiseOrNot<IStackTraceResponseBody>;
    scopes(args: DebugProtocol.ScopesArguments): PromiseOrNot<IScopesResponseBody>;
    variables(args: DebugProtocol.VariablesArguments): PromiseOrNot<IVariablesResponseBody>;
    source(args: DebugProtocol.SourceArguments): PromiseOrNot<ISourceResponseBody>;
    threads(): PromiseOrNot<IThreadsResponseBody>;
    evaluate(args: DebugProtocol.EvaluateArguments): PromiseOrNot<IEvaluateResponseBody>;
}

interface IDebugTransformer {
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
