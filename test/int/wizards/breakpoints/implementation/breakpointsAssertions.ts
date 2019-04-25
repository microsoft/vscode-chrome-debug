import * as assert from 'assert';
import { expect, use } from 'chai';
import * as chaiString from 'chai-string';
import { DebugProtocol } from 'vscode-debugprotocol';
import { THREAD_ID } from 'vscode-chrome-debug-core-testsupport';
import { BreakpointWizard } from '../breakpointWizard';
import { InternalFileBreakpointsWizard, CurrentBreakpointsMapping } from './internalFileBreakpointsWizard';
import { BreakpointsWizard } from '../breakpointsWizard';
import { waitUntilReadyWithTimeout } from '../../../utils/waitUntilReadyWithTimeout';
import { isThisV2 } from '../../../testSetup';
import { findLineNumber } from '../../../utils/findPositionOfTextInFile';

use(chaiString);

export class BreakpointsAssertions {
    public constructor(
        private readonly _breakpointsWizard: BreakpointsWizard,
        private readonly _internal: InternalFileBreakpointsWizard,
        public readonly currentBreakpointsMapping: CurrentBreakpointsMapping) { }

    public assertIsVerified(breakpoint: BreakpointWizard): void {
        const breakpointStatus = this.currentBreakpointsMapping.get(breakpoint);
        assert(breakpointStatus.verified, `Expected ${breakpoint} to be verified yet it wasn't: ${breakpointStatus.message}`);
        // Convert to one based to match the VS Code potocol and what VS Code does if you try to open that file at that line number
        // const oneBasedExpectedLineNumber = breakpoint.position.lineNumber + 1;
        // const oneBasedExpectedColumnNumber = breakpoint.position.columnNumber + 1;
        // const filePath = this._internal.filePath;

        // TODO: Re-enable this once we figure out how to deal with source-maps that do unexpected things
        // assert.equal(breakpointStatus.line, oneBasedExpectedLineNumber,
        //     `Expected ${breakpoint} actual line to be ${filePath}:${oneBasedExpectedLineNumber}:${oneBasedExpectedColumnNumber}`
        //     + ` yet it was ${filePath}:${breakpointStatus.line}:${breakpointStatus.column}`);
    }

    public async waitUntilVerified(breakpoint: BreakpointWizard): Promise<void> {
        await waitUntilReadyWithTimeout(() => this.currentBreakpointsMapping.get(breakpoint).verified);
    }

    public async assertIsHitThenResumeWhen(breakpoint: BreakpointWizard, lastActionToMakeBreakpointHit: () => Promise<void>, expectedStackTrace: string): Promise<void> {
        const actionResult = lastActionToMakeBreakpointHit();
        // TODO: Re-enable this checks and validate that we hit the location that the breakpoint specifies
        // const vsCodeStatus = this.currentBreakpointsMapping.get(breakpoint);
        // const location = { path: this._internal.filePath, line: vsCodeStatus.line, colum: vsCodeStatus.column };

        await this._breakpointsWizard.waitUntilPaused(breakpoint);

        const stackTraceResponse = await this._internal.client.send('stackTrace', {
            threadId: THREAD_ID,
            format: {
                parameters: true,
                parameterTypes: true,
                parameterNames: true,
                line: true,
                module: true
            }
        });

        this.validateStackTraceResponse(stackTraceResponse);

        const formattedExpectedStackTrace = expectedStackTrace.replace(/^\s+/gm, ''); // Remove the white space we put at the start of the lines to make the stack trace align with the code
        this.applyIgnores(formattedExpectedStackTrace, stackTraceResponse);
        const actualStackTrace = this.extractStackTrace(stackTraceResponse);
        assert.equal(actualStackTrace, formattedExpectedStackTrace, `Expected the stack trace when hitting ${breakpoint} to be:\n${formattedExpectedStackTrace}\nyet it is:\n${actualStackTrace}`);

        // const scopesResponse = await this._internal.client.scopesRequest({ frameId: stackTraceResponse.body.stackFrames[0].id });
        /// const scopes = scopesResponse.body.scopes;
        await this._internal.client.continueRequest();
        if (isThisV2) {
            // TODO: Is getting this event on V2 a bug? See: Continued Event at https://microsoft.github.io/debug-adapter-protocol/specification
            await this._breakpointsWizard.waitUntilJustResumed();
        }

        await actionResult;
    }

    public applyIgnores(formattedExpectedStackTrace: string, stackTraceResponse: DebugProtocol.StackTraceResponse): void {
        const ignoreFunctionNameText = '<__IGNORE_FUNCTION_NAME__>';
        const ignoreFunctionName = findLineNumber(formattedExpectedStackTrace, formattedExpectedStackTrace.indexOf(ignoreFunctionNameText));
        if (ignoreFunctionName >= 0) {
            expect(stackTraceResponse.body.stackFrames.length).to.be.greaterThan(ignoreFunctionName);
            const ignoredFrame = stackTraceResponse.body.stackFrames[ignoreFunctionName];
            ignoredFrame.name = `${ignoreFunctionNameText} [${ignoredFrame.source!.name}] Line ${ignoredFrame.line}`;
        }
    }

    private extractStackTrace(stackTraceResponse: DebugProtocol.StackTraceResponse): string {
        return stackTraceResponse.body.stackFrames.map(f => this.printStackTraceFrame(f)).join('\n');
    }

    private printStackTraceFrame(frame: DebugProtocol.StackFrame): string {
        let frameName = frame.name;
        return `${frameName}:${frame.column}${frame.presentationHint && frame.presentationHint !== 'normal' ? ` (${frame.presentationHint})` : ''}`;
    }

    private validateStackTraceResponse(stackTraceResponse: DebugProtocol.StackTraceResponse) {
        expect(stackTraceResponse.success, `Expected the response to the stack trace request to be succesful yet it failed: ${JSON.stringify(stackTraceResponse)}`).to.equal(true);
        expect(stackTraceResponse.body.totalFrames, `The number of stackFrames was different than the value supplied on the totalFrames field`)
            .to.equal(stackTraceResponse.body.stackFrames.length);
        stackTraceResponse.body.stackFrames.forEach(frame => {
            // Warning: We don't currently validate frame.source.path
            expect(frame.source).not.to.equal(undefined);
            const expectedSourceNameAndLine = ` [${frame.source!.name}] Line ${frame.line}`;
            expect(frame.name, 'Expected the formatted name to match the source name and line supplied as individual attributes').to.endsWith(expectedSourceNameAndLine);
        });
    }
}