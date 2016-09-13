/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {DebugProtocol} from 'vscode-debugprotocol';

import {localize} from './utils';

export function attributePathNotExist(attribute: string, path: string): DebugProtocol.Message {
    return {
        id: 2007,
        format: localize('attribute.path.not.exist', "Attribute '{0}' does not exist ('{1}').", attribute, '{path}'),
        variables: { path }
    };
}

/**
 * Error stating that a relative path should be absolute
 */
export function attributePathRelative(attribute: string, path: string): DebugProtocol.Message {
    return withInfoLink(
        2008,
        localize('attribute.path.not.absolute', "Attribute '{0}' is not absolute ('{1}'); consider adding '{2}' as a prefix to make it absolute.", attribute, '{path}', '${workspaceRoot}/'),
        { path },
        20003
    );
}

/**
 * Get error with 'More Information' link.
 */
export function withInfoLink(id: number, format: string, variables: any, infoId: number): DebugProtocol.Message {
    return {
        id,
        format,
        variables,
        showUser: true,
        url: 'http://go.microsoft.com/fwlink/?linkID=534832#_' + infoId.toString(),
        urlLabel: localize('more.information', "More Information")
    };
}