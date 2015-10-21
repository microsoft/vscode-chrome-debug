declare module WebKitProtocol {
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

    module Debugger {
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

        interface ScriptParsedNotification extends Notification {
            params: Script;
        }

        interface PausedNotificationParams {
            callFrames: CallFrame[];
            reason: string;
            data: any;
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

    module Runtime {
        interface GetPropertiesParams {
            objectId: string;
            ownProperties: boolean;
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

    module Page {
        interface SetOverlayMessageRequest extends Request {
            message: string;
        }
    }
}
