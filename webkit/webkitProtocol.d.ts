declare module WebKitProtocol {
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
		object: any;
		type: string;
	}

	interface Notification {
		method: string;
		params: any;
	}

	interface ScriptParsedNotification extends Notification {
		params: Script;
	}

	interface PausedNotificationParams {
		callFrames: CallFrame[];
		reason: string;
		data: any;
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

	interface Location {
		scriptId: string;
		lineNumber: number;
		columnNumber?: number;
	}

	interface SetBreakpointRequest extends Request {
		params: {
			location: Location;
			condition?: string
		}
	}

	interface SetBreakpointResponse extends Response {
		result: {
			breakpointId: string;
			actualLocation: Location;
		}
	}
}
