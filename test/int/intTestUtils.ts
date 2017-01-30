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

/**
 * This is a copy of DebugClient's hitBreakpoint, except that it doesn't assert 'verified' by default. In the Chrome debugger, a bp may be verified or unverified at launch,
 * depending on whether it's randomly received before or after the 'scriptParsed' event for its script. So we can't always check this prop.
 */
export function hitBreakpoint(dc: DebugClient, launchArgs: any, location: { path: string, line: number, column?: number, verified?: boolean }, expected?: { path?: string, line?: number, column?: number, verified?: boolean }) : Promise<any> {
    return Promise.all([
        dc.waitForEvent('initialized').then(event => {
            return dc.setBreakpointsRequest({
                lines: [ location.line ],
                breakpoints: [ { line: location.line, column: location.column } ],
                source: { path: location.path }
            });
        }).then(response => {
            const bp = response.body.breakpoints[0];

            if (typeof location.verified === 'boolean') {
                assert.equal(bp.verified, location.verified, 'breakpoint verification mismatch: verified');
            }
            if (bp.source && bp.source.path) {
                dc.assertPath(bp.source.path, location.path, 'breakpoint verification mismatch: path');
            }
            if (typeof bp.line === 'number') {
                assert.equal(bp.line, location.line, 'breakpoint verification mismatch: line');
            }
            if (typeof location.column === 'number' && typeof bp.column === 'number') {
                assert.equal(bp.column, location.column, 'breakpoint verification mismatch: column');
            }
            return dc.configurationDoneRequest();
        }),

        dc.launch(launchArgs),

        dc.assertStoppedLocation('breakpoint', expected || location)
    ]);
}