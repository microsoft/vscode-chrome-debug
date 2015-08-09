/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {V8Protocol} from './v8Protocol';

export class Source implements OpenDebugProtocol.Source {
	name: string;
	path: string;
	sourceReference: number;
	
	public constructor(name: string, path: string, id: number = 0) {
		this.name = name;
		this.path = path;
		this.sourceReference = id;
	}
}

export class Scope implements OpenDebugProtocol.Scope {
	name: string;
	variablesReference: number;
	expensive: boolean;
	
	public constructor(name: string, reference: number, expensive: boolean = false) {
		this.name = name;
		this.variablesReference = reference;
		this.expensive = expensive;
	}
}

export class StackFrame implements OpenDebugProtocol.StackFrame {
	id: number;
	source: Source;
	line: number;
	column: number;
	name: string;
	scopes: Scope[];

	public constructor(i: number, nm: string, src: Source, ln: number, col: number, scps: Scope[]) {
		this.id = i;
		this.source = src;
		this.line = ln;
		this.column = col;
		this.name = nm;
		this.scopes = scps;
	}
}

export class Thread implements OpenDebugProtocol.Thread {
	id: number;
	name: string;

	public constructor(id: number, name: string) {
		this.id = id;
		if (name == null || name.length == 0) {
			this.name = "Thread #" + id;
		} else {
			this.name = name;
		}
	}
}

export class Variable implements OpenDebugProtocol.Variable {
	name: string;
	value: string;
	variablesReference: number;

	public constructor(name: string, value: string, ref: number = 0) {
		this.name = name;
		this.value = value;
		this.variablesReference = ref;
	}
}


export class DebugSession extends V8Protocol {
	
	private _debuggerLinesStartAt1: boolean;
	
	private _clientLinesStartAt1: boolean;
	private _clientPathFormat: string;
	
	
	public constructor(debuggerLinesStartAt1: boolean) {
		super();
		this._debuggerLinesStartAt1 = debuggerLinesStartAt1;
	}
	
	protected sendErrorResponse(response: OpenDebugProtocol.Response, message: string): void {
		response.success = false;
		response.message = response.command + ": " + message;
		this.sendResponse(response);
	}
	
	protected dispatchRequest(request: OpenDebugProtocol.Request): void {
		
		var response:OpenDebugProtocol.Response = {
			type: 'response',
			seq: 0,
			success: true,
			request_seq: request.seq,
			command: request.command
		};
				
		console.log(`command: ${request.command}(${JSON.stringify(request.arguments)})`);
		if (request.command == "initialize") {
			var args = <OpenDebugProtocol.InitializeRequestArguments> request.arguments;
			this._clientLinesStartAt1 = args.linesStartAt1;
			this._clientPathFormat = args.pathFormat;
			this.initializeRequest(<OpenDebugProtocol.InitializeResponse> response, args);
			
		} else if (request.command == "launch") {
			this.launchRequest(<OpenDebugProtocol.LaunchResponse> response, <OpenDebugProtocol.LaunchRequestArguments> request.arguments);
			
		} else if (request.command == "attach") {
			this.attachRequest(<OpenDebugProtocol.AttachResponse> response, <OpenDebugProtocol.AttachRequestArguments> request.arguments);
			
		} else if (request.command == "disconnect") {
			this.disconnectRequest(<OpenDebugProtocol.DisconnectResponse> response);
			
		} else if (request.command == "setBreakpoints") {
			this.setBreakPointsRequest(<OpenDebugProtocol.SetBreakpointsResponse> response, <OpenDebugProtocol.SetBreakpointsArguments> request.arguments);
			
		} else if (request.command == "setExceptionBreakpoints") {
			this.setExceptionBreakPointsRequest(<OpenDebugProtocol.SetExceptionBreakpointsResponse> response, <OpenDebugProtocol.SetExceptionBreakpointsArguments> request.arguments);
			
		} else if (request.command == "continue") {
			this.continueRequest(<OpenDebugProtocol.ContinueResponse> response);
			
		} else if (request.command == "next") {
			this.nextRequest(<OpenDebugProtocol.NextResponse> response);

		} else if (request.command == "stepIn") {
			this.stepInRequest(<OpenDebugProtocol.StepInResponse> response);

		} else if (request.command == "stepOut") {
			this.stepOutRequest(<OpenDebugProtocol.StepOutResponse> response);

		} else if (request.command == "pause") {
			this.pauseRequest(<OpenDebugProtocol.PauseResponse> response);

		} else if (request.command == "stackTrace") {
			this.stackTraceRequest(<OpenDebugProtocol.StackTraceResponse> response, <OpenDebugProtocol.StackTraceArguments> request.arguments);
			
		} else if (request.command == "variables") {
			this.variablesRequest(<OpenDebugProtocol.VariablesResponse> response, <OpenDebugProtocol.VariablesArguments> request.arguments);

		} else if (request.command == "source") {
			this.sourceRequest(<OpenDebugProtocol.SourceResponse> response, <OpenDebugProtocol.SourceArguments> request.arguments);

		} else if (request.command == "threads") {
			this.threadsRequest(<OpenDebugProtocol.ThreadsResponse> response);
			
		} else if (request.command == "evaluate") {
			this.evaluateRequest(<OpenDebugProtocol.EvaluateResponse> response, <OpenDebugProtocol.EvaluateArguments> request.arguments);

		} else {
			this.sendErrorResponse(response, "unhandled command " + request.command);
		}
	}
	
	protected initializeRequest(response: OpenDebugProtocol.InitializeResponse, args: OpenDebugProtocol.InitializeRequestArguments): void {
		this.sendResponse(response);
	}

	protected disconnectRequest(response: OpenDebugProtocol.DisconnectResponse): void {
		this.sendResponse(response);
	}

	protected launchRequest(response: OpenDebugProtocol.LaunchResponse, args: OpenDebugProtocol.LaunchRequestArguments): void {
		this.sendResponse(response);
	}

	protected attachRequest(response: OpenDebugProtocol.AttachResponse, args: OpenDebugProtocol.AttachRequestArguments): void {
		this.sendResponse(response);
	}

	protected setBreakPointsRequest(response: OpenDebugProtocol.SetBreakpointsResponse, args: OpenDebugProtocol.SetBreakpointsArguments): void {
		this.sendResponse(response);
	}

	protected setExceptionBreakPointsRequest(response: OpenDebugProtocol.SetExceptionBreakpointsResponse, args: OpenDebugProtocol.SetExceptionBreakpointsArguments): void {
		this.sendResponse(response);
	}
		
	protected continueRequest(response: OpenDebugProtocol.ContinueResponse) : void {
		this.sendResponse(response);
	}
	
	protected nextRequest(response: OpenDebugProtocol.NextResponse) : void {
		this.sendResponse(response);
	}

	protected stepInRequest(response: OpenDebugProtocol.StepInResponse) : void {
		this.sendResponse(response);
	}
	
	protected stepOutRequest(response: OpenDebugProtocol.StepOutResponse) : void {
		this.sendResponse(response);
	}

	protected pauseRequest(response: OpenDebugProtocol.PauseResponse) : void {
		this.sendResponse(response);
	}
	
	protected sourceRequest(response: OpenDebugProtocol.SourceResponse, args: OpenDebugProtocol.SourceArguments) : void {
		this.sendResponse(response);
	}
	
	protected threadsRequest(response: OpenDebugProtocol.ThreadsResponse): void {
		this.sendResponse(response);
	}
		
	protected stackTraceRequest(response: OpenDebugProtocol.StackTraceResponse, args: OpenDebugProtocol.StackTraceArguments): void {
		this.sendResponse(response);
	}

	protected variablesRequest(response: OpenDebugProtocol.VariablesResponse, args: OpenDebugProtocol.VariablesArguments): void {
		this.sendResponse(response);
	}
	
	protected evaluateRequest(response: OpenDebugProtocol.EvaluateResponse, args: OpenDebugProtocol.EvaluateArguments): void {
		this.sendResponse(response);
	}
		
	//-----------------------------------------------------------------------------------------------------
		
	protected convertClientLineToDebugger(line): number {
		if (this._debuggerLinesStartAt1) {
			return this._clientLinesStartAt1 ? line : line + 1;
		}
		return this._clientLinesStartAt1 ? line - 1 : line;
	}

	protected convertDebuggerLineToClient(line): number {
		if (this._debuggerLinesStartAt1) {
			return this._clientLinesStartAt1 ? line : line - 1;
		}
		return this._clientLinesStartAt1 ? line + 1 : line;
	}
	
	protected convertDebuggerColumnToClient(column): number {
		// TODO
		return column;
	}

	protected convertDebuggerPathToClient(path): string {
		return path;
	}
	
	protected createSource(path: string) : OpenDebugProtocol.Source {
		return {
			name: path,
			path: path
		};
	}

	protected createTerminatedEvent() : OpenDebugProtocol.TerminatedEvent {
		return {
			seq: 0,
			type: 'event',
			event: 'terminated'
		};
	}

	protected createInitializedEvent() : OpenDebugProtocol.InitializedEvent {
		return {
			seq: 0,
			type: 'event',
			event: 'initialized'
		};			
	}
	
	protected createStoppedEvent(reason: string, source: Source, line: number, column: number, threadId?: number): OpenDebugProtocol.StoppedEvent {
		return {
			seq: 0,
			type: 'event',
			event: 'stopped',
			body: {
				reason,
				threadId,
				source,
				line,
				column
			}
		};
	}
}
