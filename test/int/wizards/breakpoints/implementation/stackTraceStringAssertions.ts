/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { DebugProtocol } from 'vscode-debugprotocol';
import { expect } from 'chai';
import { findLineNumber } from '../../../utils/findPositionOfTextInFile';
import { BreakpointWizard } from '../breakpointWizard';
import { trimWhitespaceAndComments } from './printedTestInputl';

export class StackTraceStringAssertions {
    public constructor(
        private readonly _breakpoint: BreakpointWizard) { }

    public  assertResponseMatches(stackTraceFrames: DebugProtocol.StackFrame[], expectedString: string) {

        stackTraceFrames.forEach(frame => {
            // Warning: We don't currently validate frame.source.path
            expect(frame.source).not.to.equal(undefined);
            const expectedSourceNameAndLine = ` [${frame.source!.name}] Line ${frame.line}`;
            expect(frame.name, 'Expected the formatted name to match the source name and line supplied as individual attributes').to.endsWith(expectedSourceNameAndLine);
        });


        const formattedExpectedStackTrace = trimWhitespaceAndComments(expectedString);
        this.applyIgnores(formattedExpectedStackTrace, stackTraceFrames);
        const actualStackTrace = this.extractStackTrace(stackTraceFrames);
        assert.equal(actualStackTrace, formattedExpectedStackTrace, `Expected the stack trace when hitting ${this._breakpoint} to be:\n${formattedExpectedStackTrace}\nyet it is:\n${actualStackTrace}`);
    }

    private applyIgnores(formattedExpectedStackTrace: string, stackTrace: DebugProtocol.StackFrame[]): void {
        const ignoreFunctionNameText = '<__IGNORE_FUNCTION_NAME__>';
        const ignoreFunctionName = findLineNumber(formattedExpectedStackTrace, formattedExpectedStackTrace.indexOf(ignoreFunctionNameText));
        if (ignoreFunctionName >= 0) {
            expect(stackTrace.length).to.be.greaterThan(ignoreFunctionName);
            const ignoredFrame = stackTrace[ignoreFunctionName];
            ignoredFrame.name = `${ignoreFunctionNameText} [${ignoredFrame.source!.name}] Line ${ignoredFrame.line}`;
        }
    }

    private extractStackTrace(stackTrace: DebugProtocol.StackFrame[]): string {
        return stackTrace.map(f => this.printStackTraceFrame(f)).join('\n');
    }

    private printStackTraceFrame(frame: DebugProtocol.StackFrame): string {
        let frameName = frame.name;
        return `${frameName}:${frame.column}${frame.presentationHint && frame.presentationHint !== 'normal' ? ` (${frame.presentationHint})` : ''}`;
    }
}