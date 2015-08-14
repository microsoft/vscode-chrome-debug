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
        interface Script {
            scriptId: string;
            url: string;

            startLine?: number;
            startColumn?: number;
            endLine?: number;
            endColumn?: number;
            isContentScript?: boolean;
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
            scriptId: string;
            lineNumber: number;
            columnNumber?: number;
        }

        interface SetBreakpointRequest extends Request {
            params: {
                location: Location;
                condition?: string;
            }
        }

        interface SetBreakpointResponse extends Response {
            result: {
                breakpointId: string;
                actualLocation: Location;
            }
        }

        interface RemoveBreakpointRequest extends Request {
            params: {
                breakpointId: string;
            }
        }

        interface EvaluateOnCallFrameRequest extends Request {
            params: {
                callFrameId: string;
                expression: string;
                objectGroup: string;
                returnByValue: boolean;
            }
        }

        interface ExceptionStackFrame extends Location {
            functionName: string;
            scriptId: string;
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
                }
            }
        }

        interface SetPauseOnExceptionsRequest extends Request {
            params: {
                state: string;
            }
        }
    }

    module Runtime {
        interface GetPropertiesRequest extends Request {
            params: {
                objectId: string;
                ownProperties: boolean;
            }
        }

        interface GetPropertiesResponse extends Response {
            result: {
                result: PropertyDescriptor[];
            }
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

        interface EvaluateResponse extends Response {
            result: {
                result: Runtime.RemoteObject;
                wasThrown: boolean;
            }
        }
    }

    module Page {
        interface SetOverlayMessageRequest extends Request {
            message: string;
        }
    }
}
