/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { puppeteerTest, PuppeteerTestContext } from '../puppeteer/puppeteerSuite';
import { setBreakpoint } from '../intTestSupport';
import { LaunchWebServer } from '../fixtures/launchWebServer';
import { loadProjectLabels } from '../labels';
import { TestProjectSpec } from './frameworkTestSupport';
import { DefaultFixture } from '../fixtures/defaultFixture';
import { MultipleFixtures } from '../fixtures/multipleFixtures';
import * as puppeteer from 'puppeteer';
import { PausedWizard } from '../wizards/pausedWizard';
import { BreakpointsWizard } from '../wizards/breakpoints/breakpointsWizard';

/**
 * A common framework test suite that allows for easy (one-liner) testing of various
 * functionality in different framework projects (note: this isn't a suite in the mocha sense, but rather
 * a collection of functions that return mocha tests)
 */
export class FrameworkTestSuite {
    constructor(
        private frameworkName: string,
        private suiteContext: PuppeteerTestContext
    ) {}

    private get pausedWizard(): PausedWizard {
        return this.suiteContext.launchProject!.pausedWizard;
    }

    /**
     * Test that a breakpoint set after the page loads is hit on reload
     * @param bpLabel Label for the breakpoint to set
     */
    testPageReloadBreakpoint(bpLabel: string) {
        return puppeteerTest(`${this.frameworkName} - Should hit breakpoint on page reload`, this.suiteContext,
            async (context, page) => {
                const debugClient = context.debugClient;
                const bpLocation = context.breakpointLabels.get(bpLabel);

                // wait for something on the page to ensure we're fully loaded, TODO: make this more generic?
                await page.waitForSelector('#incrementBtn');

                await setBreakpoint(debugClient, bpLocation);
                const reloaded = page.reload();

                await debugClient.assertStoppedLocation('breakpoint', bpLocation);
                await this.pausedWizard.waitAndConsumePausedEvent(() => {});

                await debugClient.continueRequest();
                await this.pausedWizard.waitAndConsumeResumedEvent();

                await reloaded;
            });
    }

    /**
     * Test that step in command works as expected.
     * @param bpLabelStop Label for the breakpoint to set
     * @param bpLabelStepIn Label for the location where the 'step out' command should land us
     */
    testStepIn(bpLabelStop: string, bpLabelStepIn: string) {
        return puppeteerTest(`${this.frameworkName} - Should step in correctly`, this.suiteContext,
        async (_context, page) => {
            const location = this.suiteContext.breakpointLabels.get(bpLabelStop);
            const stepInLocation = this.suiteContext.breakpointLabels.get(bpLabelStepIn);

            // wait for selector **before** setting breakpoint to avoid race conditions against scriptParsed event
            const incBtn = await page.waitForSelector('#incrementBtn');
            await setBreakpoint(this.suiteContext.debugClient, location);
            const clicked = incBtn.click();
            await this.suiteContext.debugClient.assertStoppedLocation('breakpoint',  location);
            await this.pausedWizard.waitAndConsumePausedEvent(() => {});

            const stopOnStep = this.suiteContext.debugClient.assertStoppedLocation('step', stepInLocation);
            await this.suiteContext.debugClient.stepInAndStop();
            await this.pausedWizard.waitAndConsumeResumedEvent();

            await stopOnStep;
            await this.pausedWizard.waitAndConsumePausedEvent(() => {});

            await this.pausedWizard.resume();
            await clicked;
        });
    }

    /**
     * Test that step over (next) command works as expected.
     * Note: currently this test assumes that next will land us on the very next line in the file.
     * @param bpLabel Label for the breakpoint to set
     */
    testStepOver(bpLabel: string) {
        return puppeteerTest(`${this.frameworkName} - Should step over correctly`, this.suiteContext,
        async (_context, page) => {
            const location = this.suiteContext.breakpointLabels.get(bpLabel);

            const incBtn = await page.waitForSelector('#incrementBtn');
            await setBreakpoint(this.suiteContext.debugClient, location);
            const clicked = incBtn.click();
            await this.suiteContext.debugClient.assertStoppedLocation('breakpoint',  location);
            await this.pausedWizard.waitAndConsumePausedEvent(() => {});

            const stopOnStep = this.suiteContext.debugClient.assertStoppedLocation('step',  { ...location, line: location.line + 1 });
            await this.suiteContext.debugClient.nextAndStop();
            await this.pausedWizard.waitAndConsumeResumedEvent();

            await stopOnStep;
            await this.pausedWizard.waitAndConsumePausedEvent(() => {});

            await this.pausedWizard.resume();
            await clicked;
        });
    }

    /**
     * Test that step out command works as expected.
     * @param bpLabelStop Label for the breakpoint to set
     * @param bpLabelStepOut Label for the location where the 'step out' command should land us
     */
    testStepOut(bpLabelStop: string, bpLabelStepOut: string) {
        return puppeteerTest(`${this.frameworkName} - Should step out correctly`, this.suiteContext,
        async (_context, page) => {
            const location = this.suiteContext.breakpointLabels.get(bpLabelStop);
            const stepOutLocation = this.suiteContext.breakpointLabels.get(bpLabelStepOut);

            const incBtn = await page.waitForSelector('#incrementBtn');
            await setBreakpoint(this.suiteContext.debugClient, location);
            const clicked = incBtn.click();
            await this.suiteContext.debugClient.assertStoppedLocation('breakpoint',  location);
            await this.pausedWizard.waitAndConsumePausedEvent(() => {});

            const stopOnStep = this.suiteContext.debugClient.assertStoppedLocation('step', stepOutLocation);
            await this.suiteContext.debugClient.stepOutAndStop();
            await this.pausedWizard.waitAndConsumeResumedEvent();

            await stopOnStep;
            await this.pausedWizard.waitAndConsumePausedEvent(() => {});

            await this.pausedWizard.resume();
            await clicked;
        });
    }

    /**
     * Test that the debug adapter can correctly pause execution
     * @param bpLocation
     */
    testPauseExecution() {
        return puppeteerTest(`${this.frameworkName} - Should correctly pause execution on a pause request`, this.suiteContext, async (_context, _page) => {
            await this.pausedWizard.pause();

            // TODO: Verify we are actually pausing in the expected line

            await this.pausedWizard.resume();
        });
    }

    /**
     * A generic breakpoint test. This can be used for many different types of breakpoint tests with the following structure:
     *
     * 1. Wait for the page to load by waiting for the selector: `waitSelectorId`
     * 2. Set a breakpoint at `bpLabel`
     * 3. Execute a trigger event that should cause the breakpoint to be hit using the function `trigger`
     * 4. Assert that the breakpoint is hit on the expected location, and continue
     *
     * @param waitSelector an html selector to identify a resource to wait for for page load
     * @param bpLabel
     * @param trigger
     */
    testBreakpointHitsOnPageAction(description: string, waitSelector: string, file: string, bpLabel: string, trigger: (page: puppeteer.Page) => Promise<void>) {
        return puppeteerTest(`${this.frameworkName} - ${description}`, this.suiteContext, async (context, page) => {
            await page.waitForSelector(`${waitSelector}`);
            const breakpoints = BreakpointsWizard.create(context.debugClient, context.testSpec);
            const breakpointWizard = breakpoints.at(file);
            const bp = await breakpointWizard.breakpoint({ text: bpLabel });
            await bp.assertIsHitThenResumeWhen(() => trigger(page));
        });
    }
}

/**
 * Test that we can stop on a breakpoint set before launch
 * @param bpLabel Label for the breakpoint to set
 */
export function testBreakOnLoad(frameworkName: string, testSpec: TestProjectSpec, bpLabel: string) {
    const testTitle = `${frameworkName} - Should stop on breakpoint on initial page load`;
    return test(testTitle, async () => {
        const defaultFixture = await DefaultFixture.createWithTitle(testTitle);
        const launchWebServer = await LaunchWebServer.launch(testSpec);
        const fixture = new MultipleFixtures(launchWebServer, defaultFixture);

        try {
            const breakpointLabels = await loadProjectLabels(testSpec.props.webRoot);
            const location = breakpointLabels.get(bpLabel);
            await defaultFixture.debugClient
                .hitBreakpointUnverified(launchWebServer.launchConfig, location);
        } finally {
            await fixture.cleanUp();
        }
    });
}
