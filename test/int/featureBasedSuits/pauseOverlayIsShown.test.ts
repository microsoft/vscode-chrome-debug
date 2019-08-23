/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { testUsing } from '../fixtures/testUsing';
import { TestProjectSpec } from '../framework/frameworkTestSupport';
import { LaunchProject } from '../fixtures/launchProject';
import { launchArgs } from '../testSetup';
import { expect } from 'chai';
import * as _ from 'lodash';
import { utils } from 'vscode-chrome-debug-core';
import { readFileP } from '../../testUtils';

// There is no way to validate whether we are showing the paused overlay with puppeteer, so we look into the debug-adapter
// log and see if we sent the proper Overlay.setPausedInDebuggerMessage message
async function latestPausedOverlay(): Promise<string | undefined> {
    // Wait a little to give the log file time to get written...
    // Warning: If this test starts failing because 500 ms being too little time, we should change the logic to read the file, and retry a few times to see if the assertion passes eventually
    // If that doesn't work either, we'll need to do something less hacky like implementing a sniffer or proxy of the protocol, and get the information directly from there instead of
    // reading it from a file
    await utils.promiseTimeout(undefined, 500);

    const logFilePath = launchArgs().logFilePath!;
    const logFileContents = await readFileP(logFilePath);
    const lines = logFileContents.split('\n');
    const lastEvent = _.findLast(lines, line => line.indexOf('Overlay.setPausedInDebuggerMessage') >= 0);
    expect(lastEvent).to.not.equal(undefined);

    // We are trying to match this string: Overlay.setPausedInDebuggerMessage\",\"params\":{ <contents here> }
    const matches = lastEvent!.match(/Overlay\.setPausedInDebuggerMessage\\",\\"params\\":\{([^}]*)\}/);
    expect(matches).to.not.equal(null);
    expect(matches!.length).to.equal(2);
    return matches![1];
}

suite('Pause overlay is shown', () => {
    testUsing('when hitting a debugger statement', context => LaunchProject.launch(context,
        TestProjectSpec.fromTestPath('featuresTests/pausedOverlay')),
        async (launchProject) => {
            await launchProject.pausedWizard.waitUntilPausedOnDebuggerStatement();
            expect(await latestPausedOverlay()).to.equal(`\\"message\\":\\"Paused in Visual Studio Code\\"`);

            await launchProject.pausedWizard.resume();
            expect(await latestPausedOverlay()).to.equal(''); // An empty message removes the overlay
        });
});
