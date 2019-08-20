import { puppeteerSuite, puppeteerTest } from '../puppeteer/puppeteerSuite';

import { reactTestSpecification } from '../resources/resourceProjects';
import { BreakpointsWizard } from '../wizards/breakpoints/breakpointsWizard';

puppeteerSuite('Multiple breakpoints on a React project', reactTestSpecification, (suiteContext) => {
    puppeteerTest('Can hit two valid breakpoints, while we set them with an invalid hit count breakpoints', suiteContext, async (_context, page) => {
        const incBtn = await page.waitForSelector('#incrementBtn');

        const breakpoints = BreakpointsWizard.create(suiteContext.debugClient, reactTestSpecification);
        const counterBreakpoints = breakpoints.at('Counter.jsx');

        const { setStateBreakpoint, setNewValBreakpoint } = await counterBreakpoints.batch(async () => ({
            stepInBreakpoint: (await (await counterBreakpoints.unsetHitCountBreakpoint({
                text: 'this.stepIn();',
                boundText: 'stepIn()',
                hitCountCondition: 'bad bad hit count breakpoint condition = 2'
            })).setWithoutVerifying()), // We want the invalid condition to be first to see that the other 2 breakpoints are actually set

            setNewValBreakpoint: await counterBreakpoints.breakpoint({
                text: 'const newval = this.state.count + 1',
                boundText: 'state.count + 1'
            }),

            setStateBreakpoint: await counterBreakpoints.breakpoint({
                text: 'this.setState({ count: newval });',
                boundText: 'setState({ count: newval })'
            }),
        }));

        await breakpoints.assertIsHitThenResumeWhen([setNewValBreakpoint, setStateBreakpoint], () => incBtn.click(), {});

        await breakpoints.waitAndAssertNoMoreEvents();

        await counterBreakpoints.batch(async () => {
            await setStateBreakpoint.unset();
            await setNewValBreakpoint.unset();
        });
    });
});