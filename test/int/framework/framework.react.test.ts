/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*
 * Integration tests for the React framework
 */

import * as path from 'path';
import * as testSetup from '../testSetup';
import { setBreakpoint, setConditionalBreakpoint } from '../intTestSupport';
import { puppeteerSuite, puppeteerTest } from '../puppeteer/puppeteerSuite';
import { FrameworkTestSuite, testBreakOnLoad } from './frameworkCommonTests';
import { TestProjectSpec } from './frameworkTestSupport';

const DATA_ROOT = testSetup.DATA_ROOT;
const REACT_PROJECT_ROOT = path.join(DATA_ROOT, 'react', 'dist');
const TEST_SPEC = new TestProjectSpec( { projectRoot: REACT_PROJECT_ROOT } );

// This test doesn't use puppeteer, so we leave it outside the suite
testBreakOnLoad('React', TEST_SPEC, 'react_App_render');

puppeteerSuite('React Framework Tests', TEST_SPEC, (suiteContext) => {

    suite('Common Framework Tests', () => {
        const frameworkTests = new FrameworkTestSuite('React', suiteContext);
        frameworkTests.testPageReloadBreakpoint('react_App_render');
        frameworkTests.testPauseExecution();
        frameworkTests.testStepOver('react_Counter_increment');
        frameworkTests.testStepOut('react_Counter_increment', 'react_Counter_stepOut');
        frameworkTests.testStepIn('react_Counter_stepInStop', 'react_Counter_stepIn');
    });

    suite('React specific tests', () => {

        puppeteerTest('Should hit breakpoint in .jsx file', suiteContext, async (_context, page) => {
            const pausedWizard = suiteContext.launchProject!.pausedWizard;

            const location = suiteContext.breakpointLabels.get('react_Counter_increment');
            const incBtn = await page.waitForSelector('#incrementBtn');

            await setBreakpoint(suiteContext.debugClient, location);
            const clicked = incBtn.click();
            await suiteContext.debugClient.assertStoppedLocation('breakpoint',  location);
            await pausedWizard.waitAndConsumePausedEvent(() => {});

            await pausedWizard.resume();
            await clicked;
        });

        puppeteerTest('Should hit conditional breakpoint in .jsx file', suiteContext, async (_context, page) => {
            const pausedWizard = suiteContext.launchProject!.pausedWizard;

            const location = suiteContext.breakpointLabels.get('react_Counter_increment');
            const incBtn = await page.waitForSelector('#incrementBtn');

            await setConditionalBreakpoint(suiteContext.debugClient, location, 'this.state.count == 2');
            // click 3 times, state will be = 2 on the third click
            await incBtn.click();
            await incBtn.click();
            // don't await the last click, as the stopped debugger will deadlock it
            const clicked = incBtn.click();
            await suiteContext.debugClient.assertStoppedLocation('breakpoint',  location);
            await pausedWizard.waitAndConsumePausedEvent(() => {});

            // Be sure to await the continue request, otherwise sometimes the last click promise will
            // be rejected because the chrome instance is closed before it completes.
            await pausedWizard.resume();
            await clicked;
        });

    });
});
