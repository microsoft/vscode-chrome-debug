/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as path from 'path';
import * as testSetup from '../../../testSetup';
import { expect } from 'chai';
import { DebugProtocol } from 'vscode-debugprotocol';
import { BreakpointsWizard } from '../breakpointsWizard';
import { URL } from 'url';

export interface ExpectedSource {
    fileRelativePath?: string;
    url?: URL;
    evalCode?: boolean;
}

export interface ExpectedFrame {
    name: string | RegExp;
    line?: number;
    column?: number;
    source?: ExpectedSource;
    presentationHint?: string;
}

export class StackTraceObjectAssertions {
    private readonly _projectRoot: string;

    public constructor(breakpointsWizard: BreakpointsWizard) {
        this._projectRoot = breakpointsWizard.project.props.projectRoot;
    }

    private assertSourceMatches(actual: DebugProtocol.Source | undefined, expected: ExpectedSource | undefined, index: number) {
        if (actual == null && expected == null) {
            return;
        }

        if (expected == null) {
            assert.fail(`Source was returned for frame ${index} but none was expected`);
            return;
        }

        if (actual == null) {
            assert.fail(`Source was expected for frame ${index} but none was returned`);
            return;
        }

        let expectedName: string;
        let expectedPath: string;

        if (expected.fileRelativePath) {
            // Generate the expected path from the relative path and the project root
            expectedPath = path.join(this._projectRoot, expected.fileRelativePath);
            expectedName = path.parse(expectedPath).base;
        } else if (expected.url) {
            expectedName = expected.url.host;
            expectedPath = expected.url.toString();
        } else if (expected.evalCode === true) {
            // Eval code has source that looks like 'VM123'. Check it by regex instead.
            expect(actual.name).to.match(/.*VM.*/, `Frame ${index} source name`);
            expect(actual.path).to.match(/.*VM.*/, `Frame ${index} source path`);
            return;
        } else {
            assert.fail('Not enough information for expected source: set either "fileRelativePath" or "urlRelativePath" or "eval"');
            return;
        }

        expect(actual.name).to.equal(expectedName, `Frame ${index} source name`);
        expect(actual.path).to.equal(expectedPath, `Frame ${index} source path`);
    }

    private assertFrameMatches(actual: DebugProtocol.StackFrame, expected: ExpectedFrame, index: number) {
        if (typeof expected.name === 'string') {
            expect(actual.name).to.equal(expected.name, `Frame ${index} name`);
        } else if (expected.name instanceof RegExp) {
            expect(actual.name).to.match(expected.name, `Frame ${index} name`);
        }

        expect(actual.line).to.equal(expected.line, `Frame ${index} line`);
        expect(actual.column).to.equal(expected.column, `Frame ${index} column`);

        // Normal V1 stack frames will have no presentationHint, normal V2 stack frames will have presentationHint 'normal'
        if (testSetup.isThisV1 && expected.presentationHint === 'normal') {
            // tslint:disable-next-line:no-unused-expression
            expect(actual.presentationHint, `Frame ${index} presentationHint`).to.be.undefined;
        } else {
            expect(actual.presentationHint).to.equal(expected.presentationHint, `Frame ${index} presentationHint`);
        }

        this.assertSourceMatches(actual.source, expected.source, index);
    }

    private assertResponseMatchesFrames(actualFrames: DebugProtocol.StackFrame[], expectedFrames: ExpectedFrame[]) {
        // Check array length
        expect(actualFrames.length).to.equal(expectedFrames.length, 'Number of stack frames');

        // Check each frame
        actualFrames.forEach((actualFrame, i) => {
            this.assertFrameMatches(actualFrame, expectedFrames[i], i);
        });
    }

    public assertResponseMatches(stackTraceFrames: DebugProtocol.StackFrame[], expectedFrames: ExpectedFrame[]) {
        try {
            this.assertResponseMatchesFrames(stackTraceFrames, expectedFrames);
        } catch (e) {
            const error: assert.AssertionError = e;
            error.message += '\nActual stack trace response: \n' + JSON.stringify(stackTraceFrames, null, 2);

            throw error;
        }
    }
 }