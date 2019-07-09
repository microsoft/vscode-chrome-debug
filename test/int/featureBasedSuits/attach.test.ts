/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { testUsing } from '../fixtures/testUsing';
import { TestProjectSpec } from '../framework/frameworkTestSupport';
import { LaunchProject } from '../fixtures/launchProject';
import { utils } from 'vscode-chrome-debug-core';
import { DebugProtocol } from 'vscode-debugprotocol';
import { isWindows } from '../testSetup';
import { onUnhandledException } from '../utils/onUnhandledException';

const waitForOutput = utils.promiseDefer();

const testSpec = TestProjectSpec.fromTestPath('featuresTests/attachNoUrl');

// TODO: The attach test is currently failing on MAC. We need to investigate it and fix it
(isWindows ? testUsing : testUsing.skip)('Attach without specifying an url parameter', context => LaunchProject.attach(context,
    testSpec, undefined, {
        registerListeners: client => {
            // This test tests 2 different things while attaching:
            // 1. We don't get an unhandled error while attaching (due to Runtime.consoleAPICalled being called with a scriptId that hasn't been parsed yet)
            onUnhandledException(client, exceptionMessage => waitForOutput.reject(exceptionMessage));

            client.on('output', (args: DebugProtocol.OutputEvent) => {
                // 2. We eventually see this console.log message, because we attached succesfully to the web-page
                if (args.body.category === 'stdout' && args.body.output.startsWith('If you see this message, you are attached...')) {
                    // Wait 1 second to see if any unhandled errors happen while attaching to the page
                    utils.promiseTimeout(undefined, 1000).then(() => {
                        waitForOutput.resolve();
                    });
                }
            });
        }
    }),
    async () => {
        await waitForOutput.promise;
    });
