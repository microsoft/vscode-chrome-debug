/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';

import {DebugClient} from 'vscode-debugadapter-testsupport';
import {DebugProtocol} from 'vscode-debugprotocol';

export const THREAD_ID = 1;

export function waitForEvent(dc: DebugClient, eventType: string): Promise<DebugProtocol.Event> {
    return dc.waitForEvent(eventType, 2e3);
}

export function setBreakpointOnStart(dc: DebugClient, bps: DebugProtocol.SourceBreakpoint[], program: string, expLine?: number, expCol?: number, expVerified = true): Promise<void> {
    return waitForEvent(dc, 'initialized')
        .then(event => setBreakpoint(dc, bps, program, expLine, expCol, expVerified))
        .then(() => dc.configurationDoneRequest())
        .then(() => { });
}

export function setBreakpoint(dc: DebugClient, bps: DebugProtocol.SourceBreakpoint[], program: string, expLine?: number, expCol?: number, expVerified = true): Promise<void> {
    return dc.setBreakpointsRequest({
        breakpoints: bps,
        source: { path: program }
    }).then(response => {
        const bp = response.body.breakpoints[0];

        if (typeof expVerified === 'boolean') assert.equal(bp.verified, expVerified, 'breakpoint verification mismatch: verified');
        if (typeof expLine === 'number') assert.equal(bp.line, expLine, 'breakpoint verification mismatch: line');
        if (typeof expCol === 'number') assert.equal(bp.column, expCol, 'breakpoint verification mismatch: column');
    })
}
