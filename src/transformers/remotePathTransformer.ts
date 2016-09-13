/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {ISetBreakpointsArgs, ILaunchRequestArgs, IAttachRequestArgs, IStackTraceResponseBody} from '../debugAdapterInterfaces';

/**
 * Converts a local path from Code to a path on the target.
 */
export class BasePathTransformer {
    public launch(args: ILaunchRequestArgs): void {
    }

    public attach(args: IAttachRequestArgs): void {
    }

    public setBreakpoints(args: ISetBreakpointsArgs): Promise<void> {
        return Promise.resolve<void>();
    }

    public clearClientContext(): void {
    }

    public clearTargetContext(): void {
    }

    public scriptParsed(scriptUrl: string): string {
        return scriptUrl;
    }

    public stackTraceResponse(response: IStackTraceResponseBody): void {
        // Have a responsibility to clean up the sourceReference here when it's not needed... See #93
        response.stackFrames.forEach(frame => {
            if (frame.source.path) {
                frame.source.sourceReference = 0;
            }
        });
    }
}
