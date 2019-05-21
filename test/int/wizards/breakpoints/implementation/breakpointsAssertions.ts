import * as assert from 'assert';
import * as path from 'path';
import { expect, use } from 'chai';
import * as chaiString from 'chai-string';
import { DebugProtocol } from 'vscode-debugprotocol';
import { THREAD_ID } from 'vscode-chrome-debug-core-testsupport';
import { BreakpointWizard } from '../breakpointWizard';
import { InternalFileBreakpointsWizard, CurrentBreakpointsMapping } from './internalFileBreakpointsWizard';
import { BreakpointsWizard } from '../breakpointsWizard';
import { waitUntilReadyWithTimeout } from '../../../utils/waitUntilReadyWithTimeout';
import { findLineNumber } from '../../../utils/findPositionOfTextInFile';
import { IExpectedVariables, VariablesAssertions } from './variablesAssertions';

use(chaiString);

export type IExpectedStackTrace = string;
export interface IStackTraceVerifier {
    format?: DebugProtocol.StackFrameFormat;
    verify: (response: DebugProtocol.StackTraceResponse) => void;
}

export interface IVerifications {
    variables?: IExpectedVariables;
    stackTrace?: IExpectedStackTrace | IStackTraceVerifier;
}

interface IObjectWithLocation {
    source?: DebugProtocol.Source;
    line?: number; // One based line number
    column?: number; // One based colum number
}

export class BreakpointsAssertions {
    private readonly _variableAssertions = new VariablesAssertions(this._internal.client);

    private readonly _defaultStackFrameFormat: DebugProtocol.StackFrameFormat = {
        parameters: true,
        parameterTypes: true,
        parameterNames: true,
        line: true,
        module: true
    };

    public constructor(
        private readonly _breakpointsWizard: BreakpointsWizard,
        private readonly _internal: InternalFileBreakpointsWizard,
        public readonly currentBreakpointsMapping: CurrentBreakpointsMapping) { }

    private getDefaultStackTraceVerifier(breakpoint: BreakpointWizard, expectedStackTrace: string): IStackTraceVerifier {
        return {
            format: this._defaultStackFrameFormat,
            verify: (stackTraceResponse) => {
                expect(stackTraceResponse.success, `Expected the response to the stack trace request to be succesful yet it failed: ${JSON.stringify(stackTraceResponse)}`).to.equal(true);

                const stackTraceFrames = stackTraceResponse.body.stackFrames;
                expect(stackTraceResponse.body.totalFrames, `The number of stackFrames was different than the value supplied on the totalFrames field`)
                    .to.equal(stackTraceFrames.length);
                stackTraceFrames.forEach(frame => {
                    // Warning: We don't currently validate frame.source.path
                    expect(frame.source).not.to.equal(undefined);
                    const expectedSourceNameAndLine = ` [${frame.source!.name}] Line ${frame.line}`;
                    expect(frame.name, 'Expected the formatted name to match the source name and line supplied as individual attributes').to.endsWith(expectedSourceNameAndLine);
                });


                const formattedExpectedStackTrace = expectedStackTrace.replace(/^\s+/gm, ''); // Remove the white space we put at the start of the lines to make the stack trace align with the code
                this.applyIgnores(formattedExpectedStackTrace, stackTraceFrames);
                const actualStackTrace = this.extractStackTrace(stackTraceFrames);
                assert.equal(actualStackTrace, formattedExpectedStackTrace, `Expected the stack trace when hitting ${breakpoint} to be:\n${formattedExpectedStackTrace}\nyet it is:\n${actualStackTrace}`);
            }
        };
    }

    public assertIsVerified(breakpoint: BreakpointWizard): void {
        // Convert to one based to match the VS Code potocol and what VS Code does if you try to open that file at that line number

        const breakpointStatus = this.currentBreakpointsMapping.get(breakpoint);
        this.assertLocationMatchesExpected(breakpointStatus, breakpoint);
        expect(breakpointStatus.verified, `Expected ${breakpoint} to be verified yet it wasn't: ${breakpointStatus.message}`).to.equal(true);
    }

    public async waitUntilVerified(breakpoint: BreakpointWizard): Promise<void> {
        await waitUntilReadyWithTimeout(() => this.currentBreakpointsMapping.get(breakpoint).verified);
    }

    public async assertIsHitThenResumeWhen(breakpoint: BreakpointWizard, lastActionToMakeBreakpointHit: () => Promise<void>, verifications: IVerifications): Promise<void> {
        const actionResult = lastActionToMakeBreakpointHit();

        await this.assertIsHitThenResume(breakpoint, verifications);

        await actionResult;
    }

    public async assertIsHitThenResume(breakpoint: BreakpointWizard, verifications: IVerifications): Promise<void> {
        await this._breakpointsWizard.waitUntilPaused(breakpoint);

        let stackTraceVerifier: IStackTraceVerifier | undefined = undefined;
        if (typeof verifications.stackTrace === 'string') {
            stackTraceVerifier = this.getDefaultStackTraceVerifier(breakpoint, verifications.stackTrace);
        } else if (typeof verifications.stackTrace === 'object') {
            stackTraceVerifier = verifications.stackTrace;
        }

        let stackFrameFormat: DebugProtocol.StackFrameFormat | undefined = undefined;
        if (stackTraceVerifier) {
            stackFrameFormat = stackTraceVerifier.format;
        }

        const stackTraceResponse = await await this._internal.client.send('stackTrace', {
            threadId: THREAD_ID,
            format: stackFrameFormat
        });
        const topFrame = stackTraceResponse.body.stackFrames[0];

        // Validate that the topFrame is locate in the same place as the breakpoint
        this.assertLocationMatchesExpected(topFrame, breakpoint);

        if (stackTraceVerifier !== undefined) {
            stackTraceVerifier.verify(stackTraceResponse);
        }

        if (verifications.variables !== undefined) {
            this._variableAssertions.assertStackTraceContains(topFrame, verifications.variables);
        }

        await this._breakpointsWizard.resume();
    }

    public applyIgnores(formattedExpectedStackTrace: string, stackTrace: DebugProtocol.StackFrame[]): void {
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

    private assertLocationMatchesExpected(objectWithLocation: IObjectWithLocation, breakpoint: BreakpointWizard): void {
        const expectedFilePath = this._internal.filePath;

        expect(objectWithLocation.source).to.not.equal(undefined);
        expect(objectWithLocation.source!.path).to.be.equal(expectedFilePath);
        expect(objectWithLocation.source!.name).to.be.equal(path.basename(expectedFilePath));

        const expectedLineNumber = breakpoint.boundPosition.lineNumber + 1;
        const expectedColumNumber = breakpoint.boundPosition.columnNumber + 1;
        const expectedBPLocationPrintted = `${expectedFilePath}:${expectedLineNumber}:${expectedColumNumber}`;
        const actualBPLocationPrintted = `${objectWithLocation.source!.path}:${objectWithLocation.line}:${objectWithLocation.column}`;

        expect(actualBPLocationPrintted).to.be.equal(expectedBPLocationPrintted);
    }
}