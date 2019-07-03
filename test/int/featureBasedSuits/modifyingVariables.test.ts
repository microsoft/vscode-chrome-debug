/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TestProjectSpec } from '../framework/frameworkTestSupport';
import { VariablesWizard } from '../wizards/variables/variablesWizard';
import { LaunchProject } from '../fixtures/launchProject';
import { testUsing } from '../fixtures/testUsing';
import { BreakpointsWizard } from '../wizards/breakpoints/breakpointsWizard';

suite('modify variable', function () {
    const testSpec = TestProjectSpec.fromTestPath('featuresTests/setVariable');
    testUsing('local', context => LaunchProject.launch(context, testSpec), async (launchProject) => {
        const variables = new VariablesWizard(launchProject.debugClient);
        const breakpoints = BreakpointsWizard.create(launchProject.debugClient, testSpec).at('../app.ts');
        const changeShouldExitBreakpoint = await breakpoints.breakpoint({ text: `console.log('Change shouldExit value here')` });
        const exitedPreviousFunctionBreakpoint = await breakpoints.breakpoint({ text: `console.log('We exited the previous function');` });

        await changeShouldExitBreakpoint.assertIsHitThenResume({
            action: async () => {
                await variables.set('shouldExit', 'true');
            }
        });

        await exitedPreviousFunctionBreakpoint.assertIsHitThenResume({});
    });
});
