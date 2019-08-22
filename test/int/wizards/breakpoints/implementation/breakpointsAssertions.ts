/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { expect, use } from 'chai';
import * as chaiString from 'chai-string';
import { DebugProtocol } from 'vscode-debugprotocol';
import { BreakpointWizard } from '../breakpointWizard';
import { InternalFileBreakpointsWizard, CurrentBreakpointsMapping } from './internalFileBreakpointsWizard';
import { waitUntilReadyWithTimeout } from '../../../utils/waitUntilReadyWithTimeout';

use(chaiString);

interface IObjectWithLocation {
    source?: DebugProtocol.Source;
    line?: number; // One based line number
    column?: number; // One based colum number
}

export class BreakpointsAssertions {
    public constructor(
        private readonly _internal: InternalFileBreakpointsWizard,
        public readonly currentBreakpointsMapping: CurrentBreakpointsMapping) { }

    public assertIsVerified(breakpoint: BreakpointWizard): void {
        // Convert to one based to match the VS Code potocol and what VS Code does if you try to open that file at that line number

        const breakpointStatus = this.currentBreakpointsMapping.get(breakpoint);
        assertMatchesBreakpointLocation(breakpointStatus, this._internal.filePath, breakpoint);
        expect(breakpointStatus.verified, `Expected ${breakpoint} to be verified yet it wasn't: ${breakpointStatus.message}`).to.equal(true);
    }

    public assertIsNotVerified(breakpoint: BreakpointWizard, unverifiedReason: string): void {
        const breakpointLocation = `res:${breakpoint.filePath}:${breakpoint.position.lineNumber + 1}:${breakpoint.position.columnNumber + 1}`;

        // For the moment we are assuming that the breakpoint maps to a single script file. If we need to support other cases we'll need to compose the message in the proper way
        const fullMessage = `[ Breakpoint at ${breakpointLocation} do: ${breakpoint.actionWhenHit} is unbound because ${unverifiedReason} ]`;

        const breakpointStatus = this.currentBreakpointsMapping.get(breakpoint);
        expect(breakpointStatus.verified, `Expected ${breakpoint} to not be verified yet it was: ${breakpointStatus.message}`).to.equal(false);
        expect(breakpointStatus.message, `Expected ${breakpoint} to have a particular unverified message`).to.equal(fullMessage);
    }

    public async waitUntilVerified(breakpoint: BreakpointWizard): Promise<void> {
        await waitUntilReadyWithTimeout(() => this.currentBreakpointsMapping.get(breakpoint).verified);
    }
}

export function assertMatchesBreakpointLocation(objectWithLocation: IObjectWithLocation, expectedFilePath: string, breakpoint: BreakpointWizard): void {
    expect(objectWithLocation.source).to.not.equal(undefined);
    expect(objectWithLocation.source!.path!.toLowerCase()).to.be.equal(expectedFilePath.toLowerCase());
    expect(objectWithLocation.source!.name!.toLowerCase()).to.be.equal(path.basename(expectedFilePath.toLowerCase()));

    const expectedLineNumber = breakpoint.boundPosition.lineNumber + 1;
    const expectedColumNumber = breakpoint.boundPosition.columnNumber + 1;
    const expectedBPLocationPrinted = `${expectedFilePath}:${expectedLineNumber}:${expectedColumNumber}`;
    const actualBPLocationPrinted = `${objectWithLocation.source!.path}:${objectWithLocation.line}:${objectWithLocation.column}`;

    expect(actualBPLocationPrinted.toLowerCase()).to.be.equal(expectedBPLocationPrinted.toLowerCase());
}
