/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { DebugProtocol } from 'vscode-debugprotocol';

import * as nls from 'vscode-nls';
import { ErrorWithMessage } from 'vscode-chrome-debug-core';
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
