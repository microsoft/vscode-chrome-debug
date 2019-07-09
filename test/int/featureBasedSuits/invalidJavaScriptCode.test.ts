/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { testUsing } from '../fixtures/testUsing';
import { TestProjectSpec } from '../framework/frameworkTestSupport';
import { LaunchProject } from '../fixtures/launchProject';
import { onUnhandledException, onHandledError } from '../utils/onUnhandledException';
import { utils } from 'vscode-chrome-debug-core';

const waitForTestResult = utils.promiseDefer();

testUsing('No unhandled exceptions when we parse invalid JavaScript code. We get a handled error', context => LaunchProject.launch(context,
    TestProjectSpec.fromTestPath('featuresTests/invalidJavaScriptCode'), {},
    {
        registerListeners: client => {
            // We fail the test if we get an unhandled exception
            onUnhandledException(client, exceptionMessage => waitForTestResult.reject(exceptionMessage));
            // We expect to get a handled error instead
            onHandledError(client, async errorMessage => {
                if (errorMessage.startsWith(`SyntaxError: Unexpected token 'function'`)) {
                    // After we get the message, we wait 1 more second to verify we don't get any unhandled exceptions, and then we succeed the test
                    await utils.promiseTimeout(undefined, 1000 /* 1 sec */);

                    waitForTestResult.resolve();
                }
            });
        }
    }),
    async (_launchProject) => {
        await waitForTestResult.promise;
    });
