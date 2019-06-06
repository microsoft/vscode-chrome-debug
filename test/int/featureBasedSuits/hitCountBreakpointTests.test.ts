/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*
 * Hit count breakpoints' scenarios
 * Hit count breakpoint syntax: (>|>=|=|<|<=|%)?\s*([0-9]+)
 */

import * as _ from 'lodash';
import { puppeteerSuite, puppeteerTest } from '../puppeteer/puppeteerSuite';
import { reactTestSpecification } from '../resources/resourceProjects';
import { BreakpointsWizard as BreakpointsWizard } from '../wizards/breakpoints/breakpointsWizard';
import { asyncRepeatSerially } from '../utils/repeat';

puppeteerSuite('Hit count breakpoints on a React project', reactTestSpecification, (suiteContext) => {
    puppeteerTest("Hit count breakpoint = 3 pauses on the button's 3rd click", suiteContext, async (_context, page) => {
        const incBtn = await page.waitForSelector('#incrementBtn');

        const breakpoints = BreakpointsWizard.create(suiteContext.debugClient, reactTestSpecification);
        const counterBreakpoints = breakpoints.at('Counter.jsx');

        const setStateBreakpoint = await counterBreakpoints.hitCountBreakpoint({
            text: 'this.setState({ count: newval });',
            boundText: 'setState({ count: newval })',
            hitCountCondition: '% 3'
        });

        await asyncRepeatSerially(2, () => incBtn.click());

        await setStateBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click());

        await incBtn.click();

        await breakpoints.waitAndAssertNoMoreEvents();

        await setStateBreakpoint.unset();
    });

    puppeteerTest("Hit count breakpoints = 3, = 4 and = 5 pause on the button's 3rd, 4th and 5th clicks", suiteContext, async (_context, page) => {
        const incBtn = await page.waitForSelector('#incrementBtn');

        const breakpoints = BreakpointsWizard.create(suiteContext.debugClient, reactTestSpecification);
        const counterBreakpoints = breakpoints.at('Counter.jsx');

        const setStateBreakpoint = await counterBreakpoints.hitCountBreakpoint({
            text: 'this.setState({ count: newval })',
            boundText: 'setState({ count: newval })',
            hitCountCondition: '= 3'
        });

        const setNewValBreakpoint = await counterBreakpoints.hitCountBreakpoint({
            text: 'const newval = this.state.count + 1',
            boundText: 'state.count + 1',
            hitCountCondition: '= 5'
        });

        const stepInBreakpoint = await counterBreakpoints.hitCountBreakpoint({
            text: 'this.stepIn()',
            boundText: 'stepIn()',
            hitCountCondition: '= 4'
        });

        await asyncRepeatSerially(2, () => incBtn.click());

        await setStateBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click());
        await stepInBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click());
        await setNewValBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click());

        await incBtn.click();

        await breakpoints.waitAndAssertNoMoreEvents();

        await setStateBreakpoint.unset();
        await setNewValBreakpoint.unset();
        await stepInBreakpoint.unset();
    });

    puppeteerTest("Hit count breakpoints = 3, = 4 and = 5 set in batch pause on the button's 3rd, 4th and 5th clicks", suiteContext, async (_context, page) => {
        const incBtn = await page.waitForSelector('#incrementBtn');

        const breakpoints = BreakpointsWizard.create(suiteContext.debugClient, reactTestSpecification);
        const counterBreakpoints = breakpoints.at('Counter.jsx');

        const { setStateBreakpoint, stepInBreakpoint, setNewValBreakpoint } = await counterBreakpoints.batch(async () => ({
            setStateBreakpoint: await counterBreakpoints.hitCountBreakpoint({
                text: 'this.setState({ count: newval });',
                boundText: 'setState({ count: newval })',
                hitCountCondition: '= 3'
            }),

            setNewValBreakpoint: await counterBreakpoints.hitCountBreakpoint({
                text: 'const newval = this.state.count + 1',
                boundText: 'state.count + 1',
                hitCountCondition: '= 5'
            }),

            stepInBreakpoint: await counterBreakpoints.hitCountBreakpoint({
                text: 'this.stepIn();',
                boundText: 'stepIn()',
                hitCountCondition: '= 4'
            })
        }));

        await asyncRepeatSerially(2, () => incBtn.click());

        await setStateBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click());
        await stepInBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click());
        await setNewValBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click());

        await incBtn.click();

        await breakpoints.waitAndAssertNoMoreEvents();

        await counterBreakpoints.batch(async () => {
            await setStateBreakpoint.unset();
            await setNewValBreakpoint.unset();
            await stepInBreakpoint.unset();
        });
    });
});
