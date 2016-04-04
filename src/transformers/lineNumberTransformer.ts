/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {DebugProtocol} from 'vscode-debugprotocol';

import {IDebugTransformer, ISetBreakpointsResponseBody, IStackTraceResponseBody} from '../chrome/debugAdapterInterfaces';

/**
 * Converts from 1 based lines on the client side to 0 based lines on the target side
 */
export class LineNumberTransformer implements IDebugTransformer  {
    private _targetLinesStartAt1: boolean;
    private _clientLinesStartAt1: boolean;

    constructor(targetLinesStartAt1: boolean) {
        this._targetLinesStartAt1 = targetLinesStartAt1;
    }

    public initialize(args: DebugProtocol.InitializeRequestArguments): void {
        this._clientLinesStartAt1 = args.linesStartAt1;
    }

    public setBreakpoints(args: DebugProtocol.SetBreakpointsArguments): void {
        args.lines = args.lines.map(line => this.convertClientLineToTarget(line));
    }

    public setBreakpointsResponse(response: ISetBreakpointsResponseBody): void {
        response.breakpoints.forEach(bp => bp.line = this.convertTargetLineToClient(bp.line));
    }

    public stackTraceResponse(response: IStackTraceResponseBody): void {
        response.stackFrames.forEach(frame => frame.line = this.convertTargetLineToClient(frame.line));
    }

    private convertClientLineToTarget(line: number): number {
        if (this._targetLinesStartAt1) {
            return this._clientLinesStartAt1 ? line : line + 1;
        }

        return this._clientLinesStartAt1 ? line - 1 : line;
    }

    private convertTargetLineToClient(line: number): number {
        if (this._targetLinesStartAt1) {
            return this._clientLinesStartAt1 ? line : line - 1;
        }

        return this._clientLinesStartAt1 ? line + 1 : line;
    }
}
