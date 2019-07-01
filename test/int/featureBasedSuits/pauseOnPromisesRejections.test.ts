/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { testUsing } from '../fixtures/testUsing';
import { TestProjectSpec } from '../framework/frameworkTestSupport';
import { LaunchProject } from '../fixtures/launchProject';

testUsing('Pause on promise rejections when unhandled exceptions are enabled', context => LaunchProject.create(context,
    TestProjectSpec.fromTestPath('featuresTests/pauseOnPromisesRejections'),
    debugClient => debugClient.setExceptionBreakpointsRequest({ 'filters': ['uncaught'] })),
    async (launchProject) => {
        await launchProject.pausedWizard.waitUntilPausedOnPromiseRejection(`Things didn't go as expected`);
    });
