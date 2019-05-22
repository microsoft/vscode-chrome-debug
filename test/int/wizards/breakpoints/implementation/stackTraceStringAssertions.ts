import * as assert from 'assert';
import { DebugProtocol } from 'vscode-debugprotocol';
import { expect } from 'chai';
import { findLineNumber } from '../../../utils/findPositionOfTextInFile';
import { BreakpointWizard } from '../breakpointWizard';

export class StackTraceStringAssertions {
    public constructor(
        private readonly _breakpoint: BreakpointWizard) { }

    public  assertResponseMatches(actualResponse: DebugProtocol.StackTraceResponse, expectedString: string) {
        expect(actualResponse.success, `Expected the response to the stack trace request to be succesful yet it failed: ${JSON.stringify(actualResponse)}`).to.equal(true);

        const stackTraceFrames = actualResponse.body.stackFrames;
        expect(actualResponse.body.totalFrames, `The number of stackFrames was different than the value supplied on the totalFrames field`)
            .to.equal(stackTraceFrames.length);
        stackTraceFrames.forEach(frame => {
            // Warning: We don't currently validate frame.source.path
            expect(frame.source).not.to.equal(undefined);
            const expectedSourceNameAndLine = ` [${frame.source!.name}] Line ${frame.line}`;
            expect(frame.name, 'Expected the formatted name to match the source name and line supplied as individual attributes').to.endsWith(expectedSourceNameAndLine);
        });


        const formattedExpectedStackTrace = expectedString.replace(/^\s+/gm, ''); // Remove the white space we put at the start of the lines to make the stack trace align with the code
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