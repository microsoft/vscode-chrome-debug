import * as assert from 'assert';
import * as path from 'path';
import * as puppeteer from 'puppeteer';
import * as testSetup from './testSetup';
import { URL } from 'url';
import { DebugProtocol } from 'vscode-debugprotocol';
import { FrameworkTestContext, TestProjectSpec } from './framework/frameworkTestSupport';
import { puppeteerSuite, puppeteerTest } from './puppeteer/puppeteerSuite';
import { setBreakpoint } from './intTestSupport';
import { THREAD_ID } from 'vscode-chrome-debug-core-testsupport';

const DATA_ROOT = testSetup.DATA_ROOT;
const SIMPLE_PROJECT_ROOT = path.join(DATA_ROOT, 'stackTrace');
const TEST_SPEC = new TestProjectSpec( { projectRoot: SIMPLE_PROJECT_ROOT } );
const TEST_URL = new URL(TEST_SPEC.props.url);

interface ExpectedSource {
    fileRelativePath?: string;
    urlRelativePath?: string;
}

interface ExpectedFrame {
    name: string;
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
    } else {
        assert.fail('Not enough information for expected source: set either "fileRelativePath" or "urlRelativePath"');
        return;
    }

    assert.equal(actual.name, expectedName, `Source name for frame ${index} does not match`);
    assert.equal(actual.path, expectedPath, `Source path for frame ${index} does not match`);
}

function assertFrameMatches(actual: DebugProtocol.StackFrame, expected: ExpectedFrame, index: number) {
    assert.equal(actual.name, expected.name, `Name for frame ${index} does not match`);
    assert.equal(actual.line, expected.line, `Line number for frame ${index} does not match`);
    assert.equal(actual.column, expected.column, `Column number for frame ${index} does not match`);

    // Normal V1 stack frames will have no presentationHint, normal V2 stack frames will have presentationHint 'normal'
    if (testSetup.isThisV1 && expected.presentationHint === 'normal') {
        assert.equal(actual.presentationHint, undefined);
    } else {
        assert.equal(actual.presentationHint, expected.presentationHint, `Presentation hint for frame ${index} does not match`);
    }

    assertSourceMatches(actual.source, expected.source, index);
}

function assertResponseMatches(actual: DebugProtocol.StackTraceResponse, expectedFrames: ExpectedFrame[]) {
    // Check totalFrames property
    assert.equal(actual.body.totalFrames, expectedFrames.length, 'Property "totalFrames" does not match number of expected frames');

    // Check array length
    const actualFrames = actual.body.stackFrames;
    assert.equal(actualFrames.length, expectedFrames.length, 'Number of stack frames in array does not match');

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
    args: DebugProtocol.StackTraceArguments;
    expectedFranes: ExpectedFrame[];
}

async function validateStackTrace(config: StackTraceValidationConfig): Promise<void> {
    // Find the breakpoint location for this test
    const location = config.suiteContext.breakpointLabels.get(config.breakPointLabel);

    // Set the breakpoint, click the button, and wait for the breakpoint to hit
    const incBtn = await config.page.waitForSelector(config.buttonIdToClick);
    await setBreakpoint(config.suiteContext.debugClient, location);
    const clicked = incBtn.click();
    await config.suiteContext.debugClient.assertStoppedLocation('breakpoint',  location);

    // Get the stack trace
    const stackTraceResponse = await config.suiteContext.debugClient.send('stackTrace', config.args);

    // Clean up the test before assertions, in case the assertions fail
    await config.suiteContext.debugClient.continueRequest();
    await clicked;

    // Assert the response is as expected
    try {
        assertResponseMatches(stackTraceResponse, config.expectedFranes);
    } catch (e) {
        const error: assert.AssertionError = e;
        error.message += '\nActual stack trace response: \n' + JSON.stringify(stackTraceResponse, null, 2);

        throw error;
    }
}

puppeteerSuite('Stack Traces', TEST_SPEC, (suiteContext) => {
    puppeteerTest('Stack trace is generated with no formatting', suiteContext, async (_context, page) => {
        await validateStackTrace({
            suiteContext: suiteContext,
            page: page,
            breakPointLabel: 'stackTraceBreakpoint',
            buttonIdToClick: '#button',
            args: {
                threadId: THREAD_ID
            },
            expectedFranes: [
                { name: '(anonymous function)', line: 7, column: 9, source: { fileRelativePath: 'app.js' }, presentationHint: 'normal'},
                { name: 'inner', line: 8, column: 7, source: { fileRelativePath: 'app.js' }, presentationHint: 'normal'},
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
            args: {
                threadId: THREAD_ID,
                format: {
                    module: true
                }
            },
            expectedFranes: [
                { name: '(anonymous function) [app.js]', line: 7, column: 9, source: { fileRelativePath: 'app.js' }, presentationHint: 'normal'},
                { name: 'inner [app.js]', line: 8, column: 7, source: { fileRelativePath: 'app.js' }, presentationHint: 'normal'},
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
            args: {
                threadId: THREAD_ID,
                format: {
                    line: true,
                }
            },
            expectedFranes: [
                { name: '(anonymous function) Line 7', line: 7, column: 9, source: { fileRelativePath: 'app.js' }, presentationHint: 'normal'},
                { name: 'inner Line 8', line: 8, column: 7, source: { fileRelativePath: 'app.js' }, presentationHint: 'normal'},
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
            args: {
                threadId: THREAD_ID,
                format: {
                    parameters: true,
                    parameterTypes: true,
                    parameterNames: true,
                    line: true,
                    module: true
                }
            },
            expectedFranes: [
                { name: '(anonymous function) [app.js] Line 7', line: 7, column: 9, source: { fileRelativePath: 'app.js' }, presentationHint: 'normal'},
                { name: 'inner [app.js] Line 8', line: 8, column: 7, source: { fileRelativePath: 'app.js' }, presentationHint: 'normal'},
                { name: '[ setTimeout ]', presentationHint: 'label'},
                { name: 'buttonClick [app.js] Line 2', line: 2, column: 5, source: { fileRelativePath: 'app.js' }, presentationHint: 'normal'},
                { name: `onclick [${TEST_URL.host}] Line 7`, line: 7, column: 49, source: { urlRelativePath: '/' }, presentationHint: 'normal'},
            ]
        });
    });
});