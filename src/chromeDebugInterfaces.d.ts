/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as Core from 'vscode-chrome-debug-core';
import { DebugProtocol } from 'vscode-debugprotocol';

export interface ICommonRequestArgs extends Core.ICommonRequestArgs {
    webRoot?: string;
    disableNetworkCache?: boolean;
    urlFilter?: string;
}

export interface ILaunchRequestArgs extends Core.ILaunchRequestArgs, ICommonRequestArgs {
    runtimeArgs?: string[];
    runtimeExecutable?: string;
    env?: { [key: string]: string; };
    cwd?: string;
    file?: string;
    url?: string;
    stopOnEntry?: boolean;
    address?: string;
    port?: number;
    userDataDir?: string|boolean;
    breakOnLoad?: boolean;
    _clientOverlayPausedMessage?: string;
    shouldLaunchChromeUnelevated?: boolean;
}

export interface IAttachRequestArgs extends Core.IAttachRequestArgs, ICommonRequestArgs {
}

export interface ISetExpressionArgs {
    expression: string;
    value: string;
    frameId: number;
    format?: DebugProtocol.ValueFormat;
    timeout?: number;
}

export interface ISetExpressionResponseBody {
    value: string;
}

export interface VSDebugProtocolCapabilities extends DebugProtocol.Capabilities {
    supportsSetExpression?: boolean;
}
