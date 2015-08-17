/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {DebugSession} from '../common/debugSession';
import {Handles} from '../common/handles';
import {spawn} from 'child_process';

interface IPendingBreakpoint {
    response: OpenDebugProtocol.SetBreakpointsResponse;
    args: OpenDebugProtocol.SetBreakpointsArguments;
}

interface ICommittedBreakpoint {
    breakpointId: string;
    clientLine: number;
}

export class MuxDebugSession extends DebugSession {
    public constructor(debuggerLinesStartAt1: boolean) {
        super(debuggerLinesStartAt1);
    }

    protected initializeRequest(response: OpenDebugProtocol.InitializeResponse, args: OpenDebugProtocol.InitializeRequestArguments): void {
        // Nothing really to do here.
        this.sendResponse(response);
    }

    protected launchRequest(response: OpenDebugProtocol.LaunchResponse, args: OpenDebugProtocol.LaunchRequestArguments): void {
        this.sendResponse(response);
    }

    protected disconnectRequest(response: OpenDebugProtocol.DisconnectResponse): void {
        this.sendResponse(response);
    }

    protected attachRequest(response: OpenDebugProtocol.AttachResponse, args: OpenDebugProtocol.AttachRequestArguments): void {
        this.sendResponse(response);
    }

    protected setBreakPointsRequest(response: OpenDebugProtocol.SetBreakpointsResponse, args: OpenDebugProtocol.SetBreakpointsArguments): void {
    }

    protected setExceptionBreakPointsRequest(response: OpenDebugProtocol.SetExceptionBreakpointsResponse, args: OpenDebugProtocol.SetExceptionBreakpointsArguments): void {
    }

    protected continueRequest(response: OpenDebugProtocol.ContinueResponse): void {
    }

    protected nextRequest(response: OpenDebugProtocol.NextResponse): void {
    }

    protected stepInRequest(response: OpenDebugProtocol.StepInResponse): void {
    }

    protected stepOutRequest(response: OpenDebugProtocol.StepOutResponse): void {
    }

    protected pauseRequest(response: OpenDebugProtocol.PauseResponse): void {
    }

    protected sourceRequest(response: OpenDebugProtocol.SourceResponse, args: OpenDebugProtocol.SourceArguments): void {
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
}
