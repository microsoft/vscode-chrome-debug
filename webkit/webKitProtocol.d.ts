declare namespace WebKitProtocol {
    interface Notification {
        method: string;
        params: any;
    }

    interface Request {
        id: number;
        method: string;
        params?: any;
    }

    interface Response {
        id: number;
        error?: any;
        result?: any;
    }

    namespace Debugger {
        type ScriptId = string;
        type BreakpointId = string;

        interface Script {
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

        interface CallFrame {
            callFrameId: string;
            functionName: string;
            location: Location;
            scopeChain: Scope[];
            this: any;
        }

        interface Scope {
            object: Runtime.RemoteObject;
            type: string;
        }

        interface PausedParams {
            callFrames: CallFrame[];
            // 'exception' or 'other'
            reason: string;
            data: Runtime.RemoteObject;
            hitBreakpoints: BreakpointId[];
        }

        interface BreakpointResolvedParams {
            breakpointId: BreakpointId;
            location: Location;
        }

        interface Location {
            scriptId: ScriptId;
            lineNumber: number;
            columnNumber?: number;
        }

        interface SetBreakpointParams {
            location: Location;
            condition?: string;
        }

        interface SetBreakpointResponse extends Response {
            result: {
                breakpointId: BreakpointId;
                actualLocation: Location;
            };
        }

        interface SetBreakpointByUrlParams {
            url?: string;
            urlRegex?: string;
            lineNumber: number;
            columnNumber: number;
            condition?: string;
        }

        interface SetBreakpointByUrlResponse extends Response {
            result: {
                breakpointId: BreakpointId;
                locations: Location[];
            };
        }

        interface RemoveBreakpointParams {
            breakpointId: BreakpointId;
        }

        interface EvaluateOnCallFrameParams {
            callFrameId: string;
            expression: string;
            objectGroup: string;
            returnByValue: boolean;
        }

        interface ExceptionStackFrame extends Location {
            functionName: string;
            scriptId: ScriptId;
            url: string;
        }

        interface EvaluateOnCallFrameResponse extends Response {
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

        interface SetPauseOnExceptionsParams {
            state: string;
        }

        interface GetScriptSourceParams {
            scriptId: ScriptId;
        }

        interface GetScriptSourceResponse extends Response {
            result: {
                scriptSource: string;
            };
        }
    }

    namespace Runtime {
        interface GetPropertiesParams {
            objectId: string;
            ownProperties: boolean;
            accessorPropertiesOnly: boolean;
        }

        interface GetPropertiesResponse extends Response {
            result: {
                result: PropertyDescriptor[];
            };
        }

        interface PropertyDescriptor {
            configurable: boolean;
            enumerable: boolean;
            get?: RemoteObject;
            name: string;
            set?: RemoteObject;
            value?: RemoteObject;
            wasThrown?: boolean;
            writeable?: boolean;
        }

        interface RemoteObject {
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

        interface PropertyPreview {
            name: string;
            type: string;
            subtype?: string;
            value: string;
        }

        interface EvaluateParams {
            expression: string;
            objectGroup: string;
            contextId: number;
            returnByValue: boolean;
        }

        interface EvaluateResponse extends Response {
            result: {
                result: Runtime.RemoteObject;
                wasThrown: boolean;
            };
        }
    }

    namespace Page {
        interface SetOverlayMessageRequest extends Request {
            message: string;
        }
    }

    namespace Console {
        interface CallFrame {
            lineNumber: number;
            columnNumber: number;
            functionName: string;
            scriptId: Debugger.ScriptId;
            url: string;
        }

        type StackTrace = CallFrame[];

        interface MessageAddedParams {
            message: Message;
        }

        interface Message {
            line?: number;
            column?: number;

            // 'debug', 'error', 'log', 'warning'
            level: string;

            // 'assert', 'clear', 'dir', 'dirxml', 'endGroup', 'log', 'profile', 'profileEnd',
            // 'startGroup', 'startGroupCollapsed', 'table', 'timing', 'trace'
            type?: string;

            parameters?: Runtime.RemoteObject[];
            repeatCount?: string;
            stackTrace?: StackTrace;
            text: string;
            url?: string;
            source?: string;
            timestamp?: number;
            executionContextId?: number;
        }
    }
}
