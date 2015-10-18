/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {Response} from '../common/v8Protocol';
import {DebugSession, StoppedEvent, InitializedEvent, TerminatedEvent, ErrorDestination} from '../common/debugSession';
import {Handles} from '../common/handles';
import {WebKitConnection} from './webKitConnection';
import Utilities = require('./utilities');
import {ISourceMaps, SourceMaps} from './sourceMaps';
import {WebKitDebugAdapter} from './webKitDebugAdapter';

import {Socket, createServer} from 'net';
import {spawn, ChildProcess} from 'child_process';
import nodeUrl = require('url');
import path = require('path');
import fs = require('fs');

export class WebKitDebugSession extends DebugSession {
    private static THREAD_ID = 1;
    private static PAGE_PAUSE_MESSAGE = 'Paused in Visual Studio Code';

    private _clientCWD: string;
    private _clientAttached: boolean;
    private _targetAttached: boolean;
    private _variableHandles: Handles<string>;
    private _currentStack: WebKitProtocol.Debugger.CallFrame[];
    private _committedBreakpointsByScriptId: Map<WebKitProtocol.Debugger.ScriptId, WebKitProtocol.Debugger.BreakpointId[]>;
    private _sourceMaps: ISourceMaps;
    private _overlayHelper: Utilities.DebounceHelper;

    private _chromeProc: ChildProcess;
    private _webKitConnection: WebKitConnection;

    // Scripts
    private _scriptsById: Map<WebKitProtocol.Debugger.ScriptId, WebKitProtocol.Debugger.Script>;
    private _scriptsByUrl: Map<string, WebKitProtocol.Debugger.Script>;

    private _setBreakpointsRequestQ: Promise<void>;

    private _debugAdapter: IDebugAdapter;

    public constructor(debuggerLinesStartAt1: boolean, isServer: boolean = false) {
        super(debuggerLinesStartAt1, isServer);
        this._variableHandles = new Handles<string>();
        this._overlayHelper = new Utilities.DebounceHelper(/*timeoutMs=*/200);

        this._debugAdapter = new WebKitDebugAdapter(debuggerLinesStartAt1, isServer);
        this._debugAdapter.registerEventHandler(event => this.sendEvent(event));
    }

    public sendEvent(event: DebugProtocol.Event): void {
        console.log(`To client: ${JSON.stringify(event) }`);
        super.sendEvent(event);
    }

    public sendResponseAsync(response: DebugProtocol.Response, responseP: Promise<any>): void {
        responseP.then(
            (body) => {
                response.body = body;
                this.sendResponse(response);
            },
            e => {
                console.log(e.toString());
                response.message = e.toString();
                response.success = false;
                this.sendResponse(response);
            });
    }

    public sendResponse(response: DebugProtocol.Response): void {
        console.log(`To client: ${JSON.stringify(response) }`);
        super.sendResponse(response);
    }

    protected dispatchRequest(request: DebugProtocol.Request): void {
        console.log(`From client: ${request.command}(${JSON.stringify(request.arguments) })`);

        const response = new Response(request);
        try {
            if (request.command in this._debugAdapter) {
                this.sendResponseAsync(
                    response,
                    this._debugAdapter[request.command](request.arguments));
            } else {
                this.sendErrorResponse(response, 1014, "unrecognized request", null, ErrorDestination.Telemetry);
            }
        } catch (e) {
            this.sendErrorResponse(response, 1104, "exception while processing request (exception: {_exception})", { _exception: e.message }, ErrorDestination.Telemetry);
        }
    }
}
