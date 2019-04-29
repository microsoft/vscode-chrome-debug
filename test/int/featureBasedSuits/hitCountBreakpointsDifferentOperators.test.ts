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
import { reactWithLoopTestSpecification } from '../resources/resourceProjects';
import { BreakpointsWizard as BreakpointsWizard } from '../wizards/breakpoints/breakpointsWizard';
import { expect } from 'chai';

puppeteerSuite('Hit count breakpoints combinations', reactWithLoopTestSpecification, (suiteContext) => {
    interface IConditionConfiguration {
        condition: string; // The condition for the hit count breakpoint
        iterationsExpectedToPause: number[]; // In which iteration numbers it should pause (e.g.: 1st, 5th, 12th, etc...)
    }

    // * Hit count breakpoint syntax: (>|>=|=|<|<=|%)?\s*([0-9]+)
    const manyConditionsConfigurations: IConditionConfiguration[] = [
        { condition: '=     0', iterationsExpectedToPause: [] },
        { condition: '= 1', iterationsExpectedToPause: [1] },
        { condition: '= 2', iterationsExpectedToPause: [2] },
        { condition: '= 12', iterationsExpectedToPause: [12] },
        { condition: '> 0', iterationsExpectedToPause: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
        { condition: '> 1', iterationsExpectedToPause: [2, 3, 4, 5, 6, 7, 8, 9, 10] },
        { condition: '>\t2', iterationsExpectedToPause: [3, 4, 5, 6, 7, 8, 9, 10] },
        { condition: '> 187', iterationsExpectedToPause: [188, 189, 190, 191] },
        { condition: '>=   0', iterationsExpectedToPause: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
        { condition: '>= 1', iterationsExpectedToPause: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
        { condition: '>= 2', iterationsExpectedToPause: [2, 3, 4, 5, 6, 7, 8, 9, 10] },
        { condition: '>= 37', iterationsExpectedToPause: [37, 38, 39] },
        { condition: '< 0', iterationsExpectedToPause: [] },
        { condition: '<  \t  \t     1', iterationsExpectedToPause: [] },
        { condition: '< 2', iterationsExpectedToPause: [1] },
        { condition: '<        \t13', iterationsExpectedToPause: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
        { condition: '<=\t    0', iterationsExpectedToPause: [] },
        { condition: '<= 1', iterationsExpectedToPause: [1] },
        { condition: '<=            15', iterationsExpectedToPause: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
        { condition: '% 0', iterationsExpectedToPause: [] },
        { condition: '% 1', iterationsExpectedToPause: [1, 2, 3, 4, 5, 6] },
        { condition: '% 2', iterationsExpectedToPause: [2, 4, 6, 8, 10] },
        { condition: '%\t3', iterationsExpectedToPause: [3, 6, 9, 12, 15] },
        { condition: '%   \t    \t   \t  12', iterationsExpectedToPause: [12, 24, 36, 48, 60] },
        { condition: '%\t\t\t17', iterationsExpectedToPause: [17, 34, 51, 68] },
        { condition: '% 37', iterationsExpectedToPause: [37, 74, 111, 148] },
    ];

    for (const conditionConfiguration of manyConditionsConfigurations) {
        puppeteerTest(`condition ${conditionConfiguration.condition}`, suiteContext, async (_context, page) => {
            const incBtn = await page.waitForSelector('#incrementBtn');
            const breakpoints = BreakpointsWizard.create(suiteContext.debugClient, reactWithLoopTestSpecification);
            const counterBreakpoints = breakpoints.at('Counter.jsx');

            const setStateBreakpoint = await counterBreakpoints.hitCountBreakpoint({
                text: 'iterationNumber * iterationNumber',
                hitCountCondition: conditionConfiguration.condition
            });

            const buttonClicked = incBtn.click();

            if (conditionConfiguration.iterationsExpectedToPause.length > 0) {
                for (const nextIterationToPause of conditionConfiguration.iterationsExpectedToPause) {
                    /**
                     * The iterationNumber variable counts in the js-debuggee code how many times the loop was executed. We verify
                     * the value of this variable to validate that a bp with = 12 paused on the 12th iteration rather than on the 1st one
                     * (The breakpoint is located in the same place in both iterations, so we need to use state to differenciate between those two cases)
                     */
                    await setStateBreakpoint.assertIsHitThenResume({ variables: { 'iterationNumber': `${nextIterationToPause}` } });
                }

                await setStateBreakpoint.unset();
                if (breakpoints.isPaused()) {
                    await breakpoints.assertIsPaused(setStateBreakpoint); // The breakpoints' wizard throws an exception if we don't consume this pause
                    await suiteContext.debugClient.continueRequest();
                }
            } else {
                await breakpoints.assertNotPaused();
            }

            await buttonClicked;
        });
    }

    // * Hit count breakpoint syntax: (>|>=|=|<|<=|%)?\s*([0-9]+)
    const manyInvalidConditions: string[] = [
        '== 3',
        '= -1',
        '> -200',
        '< -24',
        '< 64\t',
        '< 5      ',
        '>= -95',
        '<= -5',
        '\t= 1',
        '< = 4',
        '         <= 4',
        '% -200',
        'stop always',
        '       = 3     ',
        '= 1 + 1',
        '> 3.5',
    ];

    for (const invalidCondition of manyInvalidConditions) {
        puppeteerTest(`invalid condition ${invalidCondition}`, suiteContext, async () => {
            const breakpoints = BreakpointsWizard.create(suiteContext.debugClient, reactWithLoopTestSpecification);
            const counterBreakpoints = breakpoints.at('Counter.jsx');

            try {
                await counterBreakpoints.hitCountBreakpoint({
                    text: 'iterationNumber * iterationNumber',
                    hitCountCondition: invalidCondition
                });
            } catch (exception) {
                expect(exception.toString()).to.be.equal(`Error: [debugger-for-chrome] Error processing "setBreakpoints": Didn't recognize <${invalidCondition}> as a valid hit count condition`);
            }
        });
    }
});
