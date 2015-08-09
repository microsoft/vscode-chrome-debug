/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {DebugSession} from '../common/DebugSession';
import {Handles} from '../common/Handles';
import {Socket, createServer} from 'net';
import {readFileSync} from 'fs';
import {spawn, ChildProcess} from 'child_process';
import {WebKitConnection} from './webkitConnection';

class WebkitDebugSession extends DebugSession {
	private _sourceFile: string;
	private _currentLine: number;
	private _sourceLines: string[];
	private _breakPoints: any;
	private _variableHandles: Handles<string>;

	private _chromeProc: any;
	private _webKitConnection: WebKitConnection;

	private _scriptsById = new Map<string, WebKitProtocol.Script>();
	private _scriptsByUrl = new Map<string, WebKitProtocol.Script>();

	public constructor(debuggerLinesStartAt1: boolean) {
		super(debuggerLinesStartAt1);
		this._sourceFile = null;
		this._sourceLines = [];
		this._currentLine = 0;
		this._breakPoints = {};
		this._variableHandles = new Handles<string>();
	}

	protected initializeRequest(response: OpenDebugProtocol.InitializeResponse, args: OpenDebugProtocol.InitializeRequestArguments): void {
		// give UI a chance to set breakpoints (??)
		this.sendResponse(response);
		this.sendEvent(this.createInitializedEvent());
	}

	protected launchRequest(response: OpenDebugProtocol.LaunchResponse, args: OpenDebugProtocol.LaunchRequestArguments): void {
		var chromeExe = args.runtimeExecutable || "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe";
		var port = 9222;

		var chromeArgs: string[] = [];
		chromeArgs.push("--remote-debugging-port=9222");

		if (args.runtimeArguments) {
			for (var a of args.runtimeArguments) {
				chromeArgs.push(a);
			}
		}

		chromeArgs.push(args.program);

		if (args.arguments) {
			for (var a of args.arguments) {
				chromeArgs.push(a);
			}
		}

		this._chromeProc = spawn(chromeExe, chromeArgs);
		this._chromeProc.on('error', (err) => {
			console.error("chrome error: " + err);
			this.sendEvent(this.createTerminatedEvent());
		});
		this._chromeProc.on('exit', () => {
			console.error("chrome terminated");
			this.sendEvent(this.createTerminatedEvent());
		});

		this.attach(port, response);
	}

	private attach(port: number, response: OpenDebugProtocol.Response): void {
		this._webKitConnection = new WebKitConnection();
		this._webKitConnection.on('Debugger.paused', params => this.onDebuggerPaused(params));
		this._webKitConnection.on('Debugger.scriptParsed', params => this.onScriptParsed(params));
        this._webKitConnection.attach(9222);
	}

	private onDebuggerPaused(notification: WebKitProtocol.PausedNotificationParams): void {
		var scriptLocation = notification.callFrames[0].location;
		var script = this._scriptsById.get(scriptLocation.scriptId);

		this.sendEvent(this.createStoppedEvent('pause', { name: "name", path: script.url, sourceReference: parseInt(script.scriptId) }, scriptLocation.lineNumber, scriptLocation.columnNumber, 4711));
	}

	private onScriptParsed(script: WebKitProtocol.Script): void {
		this._scriptsByUrl.set(canonicalizeUrl(script.url), script);
		this._scriptsById.set(script.scriptId, script);
	}

	protected disconnectRequest(response: OpenDebugProtocol.DisconnectResponse): void {
		this.sendResponse(response);
	}

	protected attachRequest(response: OpenDebugProtocol.AttachResponse, args: OpenDebugProtocol.AttachRequestArguments): void {
		let port = args.port;
		this.attach(port, response);
	}

	protected setBreakPointsRequest(response: OpenDebugProtocol.SetBreakpointsResponse, args: OpenDebugProtocol.SetBreakpointsArguments): void {
		var script =
			args.source.path ? this._scriptsByUrl.get(canonicalizeUrl(args.source.path)) :
			args.source.sourceReference ? this._scriptsById.get("" + args.source.sourceReference) : null;

		if (script) {
			var responsePromises = args.lines
				.map(line => this._webKitConnection.setBreakpoint({ lineNumber: line, scriptId: script.scriptId }));

			Promise.all(<Iterable<any>><any>responsePromises)
				.then(responses => {
					let breakpoints = responses.map(response => {
						return <OpenDebugProtocol.Breakpoint>{
							verified: true,
							line: response.result.actualLocation.lineNumber
						};
					});

					response.body = { breakpoints };
					this.sendResponse(response);
				});
		} else {
			this.sendResponse(response);
		}
	}

	protected setExceptionBreakPointsRequest(response: OpenDebugProtocol.SetExceptionBreakpointsResponse, args: OpenDebugProtocol.SetExceptionBreakpointsArguments): void {
		this.sendResponse(response);
	}

	protected continueRequest(response: OpenDebugProtocol.ContinueResponse): void {
		this.sendResponse(response);
	}

	protected nextRequest(response: OpenDebugProtocol.NextResponse): void {
		this.sendResponse(response);
	}

	protected stepInRequest(response: OpenDebugProtocol.StepInResponse): void {
		this.sendResponse(response);
	}

	protected stepOutRequest(response: OpenDebugProtocol.StepOutResponse): void {
		this.sendResponse(response);
	}

	protected pauseRequest(response: OpenDebugProtocol.PauseResponse): void {
		this.sendResponse(response);
	}

	protected sourceRequest(response: OpenDebugProtocol.SourceResponse, args: OpenDebugProtocol.SourceArguments): void {
		this.sendResponse(response);
	}

	protected threadsRequest(response: OpenDebugProtocol.ThreadsResponse): void {
		response.body = {
			threads: [
				{
					id: 4711,
					name: "thread 1"
				}
			]
		};
		this.sendResponse(response);
	}

	protected stackTraceRequest(response: OpenDebugProtocol.StackTraceResponse, args: OpenDebugProtocol.StackTraceArguments): void {
		var frames = [];

		for (var i= 0; i < 3; i++) {
			var scopes = [];

			scopes.push({
				name: "Local",
				variablesReference: this._variableHandles.Create("local_" + i),
				expensive: false
			});
			scopes.push({
				name: "Closure",
				variablesReference: this._variableHandles.Create("closure_" + i),
				expensive: false
			});
			scopes.push({
				name: "Global",
				variablesReference: this._variableHandles.Create("global_" + i),
				expensive: false
			});

			frames.push({
				id: i,
				name: "frame " + i,
				source: this.createSource(this.convertDebuggerPathToClient(this._sourceFile)),
				line: this.convertDebuggerLineToClient(this._currentLine),
				column: 0,
				scopes: scopes
			});
		}

		response.body = {
			stackFrames: frames
		};
		this.sendResponse(response);
	}

	protected variablesRequest(response: OpenDebugProtocol.VariablesResponse, args: OpenDebugProtocol.VariablesArguments): void {
		var variables = [];
		var id = this._variableHandles.Get(args.variablesReference);
		if (id != null) {
			variables.push({
				name: id + "_i",
				value: "123",
				variablesReference: 0
			});
			variables.push({
				name: id + "_f",
				value: "3.14",
				variablesReference: 0
			});
			variables.push({
				name: id + "_s",
				value: "hello world",
				variablesReference: 0
			});
			variables.push({
				name: id + "_o",
				value: "Object",
				variablesReference: this._variableHandles.Create("object_")
			});
		}

		response.body = {
			variables: variables
		};
		this.sendResponse(response);
	}

	protected evaluateRequest(response: OpenDebugProtocol.EvaluateResponse, args: OpenDebugProtocol.EvaluateArguments): void {
		this.sendResponse(response);
	}
}

function canonicalizeUrl(url: string): string {
	return url
		.replace("file:///", "")
		.replace(/\\/g, "/")
		.toLowerCase();
}

// parse arguments
var port = 0;
var args = process.argv.slice(2);
args.forEach(function(val, index, array) {
	var portMatch = /^--server=(\d{2,5})$/.exec(val);
	if (portMatch !== null) {
		port = parseInt(portMatch[1], 10);
	}
});

// start session
var mock = new WebkitDebugSession(false);
if (port > 0) {
	console.error("waiting for v8 protocol on port " + port);
	createServer(function(socket) {
		console.error(">> accepted connection from client");
		socket.on('end', () => {
			console.error(">> client connection closed");
		});
		mock.startDispatch(socket, socket);
	}).listen(port);
} else {
	console.error("waiting for v8 protocol on stdin/stdout");
	mock.startDispatch(process.stdin, process.stdout);
}
