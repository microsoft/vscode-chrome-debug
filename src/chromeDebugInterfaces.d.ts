/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as Core from 'vscode-chrome-debug-core';
import { DebugProtocol } from 'vscode-debugprotocol';

export interface ICommonRequestArgs extends Core.ICommonRequestArgs {
    webRoot?: string;
    disableNetworkCache?: boolean;
    targetTypes?: string[];
    targetFilter?: Core.chromeConnection.ITargetFilter;
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
    port: number; // We re-declare this property because if not we get a compiler error that we cannot extend both interfaces because the port property is not compatible (one is optional)
}

export interface VSDebugProtocolCapabilities extends DebugProtocol.Capabilities {
    supportsSetExpression?: boolean;
}
