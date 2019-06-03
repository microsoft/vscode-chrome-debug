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
import { logger } from 'vscode-debugadapter';

puppeteerSuite('Hit count breakpoints combinations', reactWithLoopTestSpecification, (suiteContext) => {
    interface IConditionConfiguration {
        condition: string; // The condition for the hit count breakpoint
        iterationsExpectedToPause: number[]; // In which iteration numbers it should pause (e.g.: 1st, 5th, 12th, etc...)
        noMorePausesAfterwards: boolean;
    }

    // * Hit count breakpoint syntax: (>|>=|=|<|<=|%)?\s*([0-9]+)
    const manyConditionsConfigurations: IConditionConfiguration[] = [
        { condition: '=     0', iterationsExpectedToPause: [], noMorePausesAfterwards: true },
        { condition: '= 1', iterationsExpectedToPause: [1], noMorePausesAfterwards: true },
        { condition: '= 2', iterationsExpectedToPause: [2], noMorePausesAfterwards: true },
        { condition: '= 12', iterationsExpectedToPause: [12], noMorePausesAfterwards: true },
        { condition: '> 0', iterationsExpectedToPause: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], noMorePausesAfterwards: false },
        { condition: '> 1', iterationsExpectedToPause: [2, 3, 4, 5, 6, 7, 8, 9, 10], noMorePausesAfterwards: false },
        { condition: '>\t2', iterationsExpectedToPause: [3, 4, 5, 6, 7, 8, 9, 10], noMorePausesAfterwards: false },
        { condition: '> 187', iterationsExpectedToPause: [188, 189, 190, 191], noMorePausesAfterwards: false },
        { condition: '>=   0', iterationsExpectedToPause: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], noMorePausesAfterwards: false },
        { condition: '>= 1', iterationsExpectedToPause: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], noMorePausesAfterwards: false },
        { condition: '>= 2', iterationsExpectedToPause: [2, 3, 4, 5, 6, 7, 8, 9, 10], noMorePausesAfterwards: false },
        { condition: '>= 37', iterationsExpectedToPause: [37, 38, 39], noMorePausesAfterwards: false },
        { condition: '< 0', iterationsExpectedToPause: [], noMorePausesAfterwards: true },
        { condition: '<  \t  \t     1', iterationsExpectedToPause: [], noMorePausesAfterwards: true },
        { condition: '< 2', iterationsExpectedToPause: [1], noMorePausesAfterwards: true },
        { condition: '<        \t13', iterationsExpectedToPause: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], noMorePausesAfterwards: true },
        { condition: '<=\t    0', iterationsExpectedToPause: [], noMorePausesAfterwards: true },
        { condition: '<= 1', iterationsExpectedToPause: [1], noMorePausesAfterwards: true },
        { condition: '<=            15', iterationsExpectedToPause: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], noMorePausesAfterwards: true },
        { condition: '% 0', iterationsExpectedToPause: [], noMorePausesAfterwards: true },
        { condition: '% 1', iterationsExpectedToPause: [1, 2, 3, 4, 5, 6], noMorePausesAfterwards: false },
        { condition: '% 2', iterationsExpectedToPause: [2, 4, 6, 8, 10], noMorePausesAfterwards: false },
        { condition: '%\t3', iterationsExpectedToPause: [3, 6, 9, 12, 15], noMorePausesAfterwards: false },
        { condition: '%   \t    \t   \t  12', iterationsExpectedToPause: [12, 24, 36, 48, 60], noMorePausesAfterwards: false },
        { condition: '%\t\t\t17', iterationsExpectedToPause: [17, 34, 51, 68], noMorePausesAfterwards: false },
        { condition: '% 37', iterationsExpectedToPause: [37, 74, 111, 148], noMorePausesAfterwards: false },
    ];

    manyConditionsConfigurations.forEach(conditionConfiguration => {
        puppeteerTest(`condition ${conditionConfiguration.condition}`, suiteContext, async (_context, page) => {
            const incBtn = await page.waitForSelector('#incrementBtn');
            const breakpoints = BreakpointsWizard.create(suiteContext.debugClient, reactWithLoopTestSpecification);
            const counterBreakpoints = breakpoints.at('Counter.jsx');

            const setStateBreakpoint = await counterBreakpoints.hitCountBreakpoint({
                text: 'iterationNumber * iterationNumber',
                hitCountCondition: conditionConfiguration.condition
            });

            const buttonClicked = incBtn.click();

            for (const nextIterationToPause of conditionConfiguration.iterationsExpectedToPause) {
                /**
                 * The iterationNumber variable counts in the js-debuggee code how many times the loop was executed. We verify
                 * the value of this variable to validate that a bp with = 12 paused on the 12th iteration rather than on the 1st one
                 * (The breakpoint is located in the same place in both iterations, so we need to use state to differenciate between those two cases)
                 */
                await setStateBreakpoint.assertIsHitThenResume({ variables: { local_contains: { iterationNumber: nextIterationToPause } } });
            }

            logger.log(`No more pauses afterwards = ${conditionConfiguration.noMorePausesAfterwards}`);
            if (conditionConfiguration.noMorePausesAfterwards) {
                await breakpoints.waitAndAssertNoMoreEvents();
                await setStateBreakpoint.unset();
            } else {
                await breakpoints.waitAndConsumePausedEvent(setStateBreakpoint);
                await setStateBreakpoint.unset();
                await breakpoints.resume();
            }

            await buttonClicked;
        });
    });

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

    manyInvalidConditions.forEach(invalidCondition => {
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
    });
});
