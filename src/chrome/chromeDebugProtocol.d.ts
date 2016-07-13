/**
 * Chrome Debugging Protocol - documented at
 * https://developer.chrome.com/devtools/docs/protocol/1.1/index
 */
export interface Notification {
    method: string;
    params: any;
}

export interface Request {
    id: number;
    method: string;
    params?: any;
}

export interface Response {
    id: number;
    error?: any;
    result?: any;
}

export namespace Debugger {
    export type ScriptId = string;
    export type BreakpointId = string;

    export interface Script {
        scriptId: ScriptId;
        url: string;

        startLine?: number;
        startColumn?: number;
        endLine?: number;
        endColumn?: number;
        isInternalScript?: boolean;
        sourceMapURL?: string;
        isContentScript?: boolean;
    }

    export interface CallFrame {
        callFrameId: string;
        functionName: string;
        location: Location;
        scopeChain: Scope[];
        this: any;
    }

    export interface Scope {
        object: Runtime.RemoteObject;
        type: string;
    }

    export interface PausedParams {
        callFrames: CallFrame[];
        // 'exception' or 'other'
        reason: string;
        data: Runtime.RemoteObject;
        hitBreakpoints: BreakpointId[];
    }

    export interface BreakpointResolvedParams {
        breakpointId: BreakpointId;
        location: Location;
    }

    export interface Location {
        scriptId: ScriptId;
        lineNumber: number;
        columnNumber?: number;
    }

    export interface SetBreakpointParams {
        location: Location;
        condition?: string;
    }

    export interface SetBreakpointResponse extends Response {
        result: {
            breakpointId: BreakpointId;
            actualLocation: Location;
        };
    }

    export interface SetBreakpointByUrlParams {
        url?: string;
        urlRegex?: string;
        lineNumber: number;
        columnNumber: number;
        condition?: string;
    }

    export interface SetBreakpointByUrlResponse extends Response {
        result: {
            breakpointId: BreakpointId;
            locations: Location[];
        };
    }

    export interface RemoveBreakpointParams {
        breakpointId: BreakpointId;
    }

    export interface EvaluateOnCallFrameParams {
        callFrameId: string;
        expression: string;
        objectGroup: string;
        returnByValue: boolean;
    }

    export interface ExceptionStackFrame extends Location {
        functionName: string;
        scriptId: ScriptId;
        url: string;
    }

    export interface EvaluateOnCallFrameResponse extends Response {
        result: {
            result: Runtime.RemoteObject;
            wasThrown: boolean;
            exceptionDetails?: {
                text: string;
                url: string;
                line: number;
                column: number;
                stackTrace: ExceptionStackFrame[];
            };
        };
    }

    export interface SetPauseOnExceptionsParams {
        state: string;
    }

    export interface GetScriptSourceParams {
        scriptId: ScriptId;
    }

    export interface GetScriptSourceResponse extends Response {
        result: {
            scriptSource: string;
        };
    }
}

export namespace Runtime {
    export interface GetPropertiesParams {
        objectId: string;
        ownProperties: boolean;
        accessorPropertiesOnly: boolean;
    }

    export interface GetPropertiesResponse extends Response {
        result: {
            result: PropertyDescriptor[];
        };
    }

    export interface PropertyDescriptor {
        configurable: boolean;
        enumerable: boolean;
        get?: RemoteObject;
        name: string;
        set?: RemoteObject;
        value?: RemoteObject;
        wasThrown?: boolean;
        writeable?: boolean;
    }

    export interface RemoteObject {
        className?: string;
        description?: string;
        objectId?: string;
        subtype?: string;
        type: string;
        value?: any;
        preview?: {
            type: string;
            description: string;
            lossless: boolean;
            overflow: boolean;
            properties: PropertyPreview[];
        };
    }

    export interface PropertyPreview {
        name: string;
        type: string;
        subtype?: string;
        value: string;
    }

    export interface EvaluateParams {
        expression: string;
        objectGroup: string;
        contextId: number;
        returnByValue: boolean;
    }

    export interface EvaluateResponse extends Response {
        result: {
            result: Runtime.RemoteObject;
            wasThrown: boolean;
        };
    }

    export interface CallFrame {
        lineNumber: number;
        columnNumber: number;
        functionName: string;
        scriptId: Debugger.ScriptId;
        url: string;
    }

    export interface StackTrace {
        description?: string;
        callFrames: CallFrame[];
        parent?: StackTrace;
    }
}

export namespace Page {
    export interface SetOverlayMessageRequest extends Request {
        message: string;
    }
}

export namespace Emulation {
    interface SetDeviceMetricsOverrideParams {
        width: number;
        height: number;
        deviceScaleFactor: number;
        mobile: boolean;
        fitWindow: boolean;
        scale?: number;
        offsetX?: number;
        offsetY?: number;
        screenWidth?: number;
        screenHeight?: number;
        positionX?: number;
        positionY?: number;
        screenOrientation?: ScreenOrientation;
    }

    interface ScreenOrientation {
        type: string;
        angle: number;
    }
}

export namespace Console {
    export interface MessageAddedParams {
        message: Message;
    }

    export interface Message {
        line?: number;
        column?: number;

        // 'debug', 'error', 'log', 'warning'
        level: string;

        // 'assert', 'clear', 'dir', 'dirxml', 'endGroup', 'log', 'profile', 'profileEnd',
        // 'startGroup', 'startGroupCollapsed', 'table', 'timing', 'trace'
        type?: string;

        parameters?: Runtime.RemoteObject[];
        repeatCount?: string;
        stack?: Runtime.StackTrace;
        text: string;
        url?: string;
        source?: string;
        timestamp?: number;
        executionContextId?: number;
    }
}

export interface ITarget {
    description: string;
    devtoolsFrontendUrl: string;
    id: string;
    thumbnailUrl?: string;
    title: string;
    type: string;
    url?: string;
    webSocketDebuggerUrl: string;
}