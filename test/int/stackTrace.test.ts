import * as assert from 'assert';
import * as path from 'path';
import * as puppeteer from 'puppeteer';
import * as testSetup from './testSetup';
import { expect } from 'chai';
import { URL } from 'url';
import { DebugProtocol } from 'vscode-debugprotocol';
import { FrameworkTestContext, TestProjectSpec } from './framework/frameworkTestSupport';
import { puppeteerSuite, puppeteerTest } from './puppeteer/puppeteerSuite';
import { BreakpointsWizard as BreakpointsWizard } from './wizards/breakpoints/breakpointsWizard';
import { IStackTraceVerifier } from './wizards/breakpoints/implementation/breakpointsAssertions';

const DATA_ROOT = testSetup.DATA_ROOT;
const SIMPLE_PROJECT_ROOT = path.join(DATA_ROOT, 'stackTrace');
const TEST_SPEC = new TestProjectSpec( { projectRoot: SIMPLE_PROJECT_ROOT, projectSrc: SIMPLE_PROJECT_ROOT } );
const TEST_URL = new URL(TEST_SPEC.props.url);

interface ExpectedSource {
    fileRelativePath?: string;
    urlRelativePath?: string;
    evalCode?: boolean;
}

interface ExpectedFrame {
    name?: string;
    nameRegExp?: RegExp;
    line?: number;
    column?: number;
    source?: ExpectedSource;
    presentationHint?: string;
}

function assertSourceMatches(actual: DebugProtocol.Source | undefined, expected: ExpectedSource | undefined, index: number) {
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
        expectedPath = path.join(TEST_SPEC.props.projectRoot, expected.fileRelativePath);
        expectedName = path.parse(expectedPath).base;
    } else if (expected.urlRelativePath) {
        // Generate the expected path from the relative path and the project url
        const url = new URL(TEST_URL.toString()); // Clone URL so we can update it
        url.pathname = expected.urlRelativePath;
        expectedName = url.host;
        expectedPath = url.toString();
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

function assertFrameMatches(actual: DebugProtocol.StackFrame, expected: ExpectedFrame, index: number) {
    if (expected.name) {
        expect(actual.name).to.equal(expected.name, `Frame ${index} name`);
    } else if (expected.nameRegExp) {
        expect(actual.name).to.match(expected.nameRegExp, `Frame ${index} name`);
    } else {
        assert.fail('Not enough information for frame name: set either "name" or "nameRegExp"');
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

    assertSourceMatches(actual.source, expected.source, index);
}

function assertResponseMatches(actual: DebugProtocol.StackTraceResponse, expectedFrames: ExpectedFrame[]) {
    // Check totalFrames property
    expect(actual.body.totalFrames).to.equal(expectedFrames.length, 'body.totalFrames');

    // Check array length
    const actualFrames = actual.body.stackFrames;
    expect(actualFrames.length).to.equal(expectedFrames.length, 'Number of stack frames');

    // Check each frame
    actualFrames.forEach((actualFrame, i) => {
        assertFrameMatches(actualFrame, expectedFrames[i], i);
    });
}

interface StackTraceValidationConfig {
    suiteContext: FrameworkTestContext;
    page: puppeteer.Page;
    breakPointLabel: string;
    buttonIdToClick: string;
    format?: DebugProtocol.StackFrameFormat;
    expectedFranes: ExpectedFrame[];
}

async function validateStackTrace(config: StackTraceValidationConfig): Promise<void> {
    const incBtn = await config.page.waitForSelector(config.buttonIdToClick);

    const breakpoints = BreakpointsWizard.create(config.suiteContext.debugClient, TEST_SPEC);
    const breakpointWizard = breakpoints.at('app.js');

    const setStateBreakpoint = await breakpointWizard.breakpoint({
        text: "console.log('Test stack trace here')"
    });

    const stackTraceVerifier: IStackTraceVerifier = {
        format: config.format,
        verify: (stackTraceResponse: DebugProtocol.StackTraceResponse) => {
            try {
                assertResponseMatches(stackTraceResponse, config.expectedFranes);
            } catch (e) {
                const error: assert.AssertionError = e;
                error.message += '\nActual stack trace response: \n' + JSON.stringify(stackTraceResponse, null, 2);

                throw error;
            }
        }
    };

    await setStateBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click(), {stackTraceVerifier: stackTraceVerifier});
}

puppeteerSuite('Stack Traces', TEST_SPEC, (suiteContext) => {
    puppeteerTest('Stack trace is generated with no formatting', suiteContext, async (_context, page) => {
        await validateStackTrace({
            suiteContext: suiteContext,
            page: page,
            breakPointLabel: 'stackTraceBreakpoint',
            buttonIdToClick: '#button',
            format: undefined,
            expectedFranes: [
                { name: '(anonymous function)', line: 11, column: 9, source: { fileRelativePath: 'app.js' }, presentationHint: 'normal'},
                { name: 'evalCallback', line: 12, column: 7, source: { fileRelativePath: 'app.js' }, presentationHint: 'normal'},
                { name: '(eval code)', line: 1, column: 1, source: { evalCode: true }, presentationHint: 'normal'},
                { name: 'timeoutCallback', line: 6, column: 5, source: { fileRelativePath: 'app.js' }, presentationHint: 'normal'},
                { name: '[ setTimeout ]', presentationHint: 'label'},
                { name: 'buttonClick', line: 2, column: 5, source: { fileRelativePath: 'app.js' }, presentationHint: 'normal'},
                { name: 'onclick', line: 7, column: 49, source: { urlRelativePath: '/' }, presentationHint: 'normal'},
            ]
        });
    });

    puppeteerTest('Stack trace is generated with module formatting', suiteContext, async (_context, page) => {
        await validateStackTrace({
            suiteContext: suiteContext,
            page: page,
            breakPointLabel: 'stackTraceBreakpoint',
            buttonIdToClick: '#button',
            format: {
                module: true
            },
            expectedFranes: [
                { name: '(anonymous function) [app.js]', line: 11, column: 9, source: { fileRelativePath: 'app.js' }, presentationHint: 'normal'},
                { name: 'evalCallback [app.js]', line: 12, column: 7, source: { fileRelativePath: 'app.js' }, presentationHint: 'normal'},
                { nameRegExp: /\(eval code\) \[.*VM.*]/, line: 1, column: 1, source: { evalCode: true }, presentationHint: 'normal'},
                { name: 'timeoutCallback [app.js]', line: 6, column: 5, source: { fileRelativePath: 'app.js' }, presentationHint: 'normal'},
                { name: '[ setTimeout ]', presentationHint: 'label'},
                { name: 'buttonClick [app.js]', line: 2, column: 5, source: { fileRelativePath: 'app.js' }, presentationHint: 'normal'},
                { name: `onclick [${TEST_URL.host}]`, line: 7, column: 49, source: { urlRelativePath: '/' }, presentationHint: 'normal'},
            ]
        });
    });

    puppeteerTest('Stack trace is generated with line formatting', suiteContext, async (_context, page) => {
        await validateStackTrace({
            suiteContext: suiteContext,
            page: page,
            breakPointLabel: 'stackTraceBreakpoint',
            buttonIdToClick: '#button',
            format: {
                line: true,
            },
            expectedFranes: [
                { name: '(anonymous function) Line 11', line: 11, column: 9, source: { fileRelativePath: 'app.js' }, presentationHint: 'normal'},
                { name: 'evalCallback Line 12', line: 12, column: 7, source: { fileRelativePath: 'app.js' }, presentationHint: 'normal'},
                { name: '(eval code) Line 1', line: 1, column: 1, source: { evalCode: true }, presentationHint: 'normal'},
                { name: 'timeoutCallback Line 6', line: 6, column: 5, source: { fileRelativePath: 'app.js' }, presentationHint: 'normal'},
                { name: '[ setTimeout ]', presentationHint: 'label'},
                { name: 'buttonClick Line 2', line: 2, column: 5, source: { fileRelativePath: 'app.js' }, presentationHint: 'normal'},
                { name: 'onclick Line 7', line: 7, column: 49, source: { urlRelativePath: '/' }, presentationHint: 'normal'},
            ]
        });
    });

    puppeteerTest('Stack trace is generated with all formatting', suiteContext, async (_context, page) => {
        await validateStackTrace({
            suiteContext: suiteContext,
            page: page,
            breakPointLabel: 'stackTraceBreakpoint',
            buttonIdToClick: '#button',
            format: {
                parameters: true,
                parameterTypes: true,
                parameterNames: true,
                line: true,
                module: true
            },
            expectedFranes: [
                { name: '(anonymous function) [app.js] Line 11', line: 11, column: 9, source: { fileRelativePath: 'app.js' }, presentationHint: 'normal'},
                { name: 'evalCallback [app.js] Line 12', line: 12, column: 7, source: { fileRelativePath: 'app.js' }, presentationHint: 'normal'},
                { nameRegExp: /\(eval code\) \[.*VM.*] Line 1/, line: 1, column: 1, source: { evalCode: true }, presentationHint: 'normal'},
                { name: 'timeoutCallback [app.js] Line 6', line: 6, column: 5, source: { fileRelativePath: 'app.js' }, presentationHint: 'normal'},
                { name: '[ setTimeout ]', presentationHint: 'label'},
                { name: 'buttonClick [app.js] Line 2', line: 2, column: 5, source: { fileRelativePath: 'app.js' }, presentationHint: 'normal'},
                { name: `onclick [${TEST_URL.host}] Line 7`, line: 7, column: 49, source: { urlRelativePath: '/' }, presentationHint: 'normal'},
            ]
        });
    });
});