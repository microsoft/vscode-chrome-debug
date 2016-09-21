/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {DebugProtocol} from 'vscode-debugprotocol';

import {ISetBreakpointsArgs, ILaunchRequestArgs, IAttachRequestArgs, IStackTraceResponseBody} from '../debugAdapterInterfaces';

/**
 * Converts a local path from Code to a path on the target.
 */
export class BasePathTransformer {
    public launch(args: ILaunchRequestArgs): Promise<void> {
        return Promise.resolve<void>();
    }

    public attach(args: IAttachRequestArgs): Promise<void> {
        return Promise.resolve<void>();
    }

    public setBreakpoints(args: ISetBreakpointsArgs): Promise<void> {
        return Promise.resolve<void>();
    }

    public clearTargetContext(): void {
    }

    public scriptParsed(scriptPath: string): string {
        return scriptPath;
    }

    public breakpointResolved(bp: DebugProtocol.Breakpoint, scriptPath: string): string {
        return scriptPath;
    }

    public stackTraceResponse(response: IStackTraceResponseBody): void {
    }
}
