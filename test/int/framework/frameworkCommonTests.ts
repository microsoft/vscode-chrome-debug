/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { puppeteerTest } from '../puppeteer/puppeteerSuite';
import { setBreakpoint, BreakpointLocation } from '../intTestSupport';
import { FrameworkTestContext } from './frameworkTestSupport';

/**
 * A common framework test suite that allows for easy (one-liner) testing of various
 * functionality in different framework projects (note: this isn't a suite in the mocha sense, but rather
 * a collection of functions that return mocha tests)
 */
export class FrameworkTestSuite {
    constructor(
        private frameworkName: string,
        private suiteContext: FrameworkTestContext
    ) {}

    /**
     * Test that we can stop on a breakpoint set before launch
     * @param bpLocation Breakpoint location
     */
    testBreakOnLoad(bpLocation: BreakpointLocation) {
        return test('Should stop on breakpoint on initial page load', async () => {
            const testSpec = this.suiteContext.testSpec;
            await this.suiteContext.debugClient
                .hitBreakpointUnverified(testSpec.launchConfig, bpLocation);
        });
    }

    /**
     * Test that a breakpoint set after the page loads is hit on reload
     * @param frameworkName The name of the framework for which this test is being run
     * @param suiteContext The puppeteer suite context
     * @param bpLocation Location for the breakpoint
     */
    testPageReloadBreakpoint(bpLocation: BreakpointLocation) {
        return puppeteerTest(`${this.frameworkName} - Should hit breakpoint on page reload`, this.suiteContext,
            async (context, page) => {
                const debugClient = context.debugClient;
                await setBreakpoint(debugClient, bpLocation);
                let reloaded = page.reload();
                await debugClient.assertStoppedLocation('breakpoint', bpLocation);
                debugClient.continueRequest();
                await reloaded;
            });
    }

    /**
     * Test that the debug adapter can correctly pause execution
     * @param bpLocation
     */
    testPauseExecution() {
        return puppeteerTest('Should correctly pause execution on a pause request', this.suiteContext, async (context, page) => {
            const debugClient = context.debugClient;
            await debugClient.pauseRequest({ threadId: 0 });
            await debugClient.waitForEvent('stopped');
            debugClient.continueRequest();
        });
    }
}
