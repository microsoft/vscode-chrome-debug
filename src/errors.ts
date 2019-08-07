/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { DebugProtocol } from 'vscode-debugprotocol';
import { ErrorWithMessage } from 'vscode-chrome-debug-core/out/src/errors';

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

/**
 * 'Path does not exist' error
 */
export function getNotExistErrorResponse(attribute: string, path: string): Promise <void> {
    return Promise.reject(new ErrorWithMessage(<DebugProtocol.Message>{
            id: 2007,
            format: localize('attribute.path.not.exist', "Attribute '{0}' does not exist ('{1}').", attribute, '{path}'),
            variables: { path }
        }));
}

export function chromeProvidedPortWithoutUserDataDir() {
    return Promise.reject(new ErrorWithMessage(<DebugProtocol.Message>{
        id: 2008,
        format: localize('random.port.no.userdatadir', 'When the remote debugging port is set to 0, you must also provide the "userDataDir" launch argument'),
        sendTelemetry: true
    }));
}

export function couldNotConnectToPort(address: string, port: number) {
    return Promise.reject(new ErrorWithMessage(<DebugProtocol.Message>{
        id: 2008,
        format: localize('launch.port.not.open', 'Could not open a connection to Chrome at: {address}:{port}', '{address}', '{port}'),
        variables: { address, port: port.toString() },
        sendTelemetry: true
    }));
}