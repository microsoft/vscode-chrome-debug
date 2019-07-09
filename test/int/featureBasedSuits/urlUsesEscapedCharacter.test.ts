/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { testUsing } from '../fixtures/testUsing';
import { TestProjectSpec } from '../framework/frameworkTestSupport';
import { LaunchProject } from '../fixtures/launchProject';
import { utils } from 'vscode-chrome-debug-core';

const testSpec = TestProjectSpec.fromTestPath('featuresTests/unusualLaunchJson/urlUsesEscapedCharacter');
const appPath = testSpec.src('../index.html');

// appPathUrl will have on Windows a character escaped like file:///C%3A/myproject/index.html
const appPathUrl = utils.pathToFileURL(appPath).replace(/file:\/\/\/([a-z]):\//, 'file:///$1%3A/');

suite('Unusual launch.json', () => {
    testUsing('Hit breakpoint when using an escape character in the url', context => LaunchProject.launch(context,
        testSpec.usingStaticUrl(appPathUrl)),
        async (launchProject) => {
            const runCodeButton = await launchProject.page.waitForSelector('#runCode');
            const breakpoint = await launchProject.breakpoints.at('../app.ts').breakpoint({ text: `console.log('line 4'); ++lineToBeExecutedNumber;` });

            await breakpoint.assertIsHitThenResumeWhen(() => runCodeButton.click());
        });
});