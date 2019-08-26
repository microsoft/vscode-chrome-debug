/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TestProjectSpec } from '../framework/frameworkTestSupport';
import { LaunchProject } from '../fixtures/launchProject';
import { testUsing } from '../fixtures/testUsing';
import { DebugProtocol } from 'vscode-debugprotocol';
import { fail } from 'assert';
import { expect } from 'chai';
import { readFileP } from '../../testUtils';

let loadedSources: DebugProtocol.Source[] = [];

function onLoadedSource(args: DebugProtocol.LoadedSourceEvent): void {
    switch (args.body.reason) {
        case 'new':
            // We ignore scripts added by puppeteer
            if (args.body.source.name !== '__puppeteer_evaluation_script__') {
                    loadedSources.push(args.body.source);
            }
            break;
        case 'changed':
        case 'removed':
            fail(`Only expected new loaded source events`);
            break;
        default:
            fail(`Unrecognized loaded source reason: ${args.body.reason}`);
    }
}

suite('loaded sources', () => {
    setup(() => {
        loadedSources = []; // Reset before each test
    });

    const testSpec = TestProjectSpec.fromTestPath('featuresTests/loadedSources/basicLoadedSources');
    testUsing('we receive events for js, ts, and eval sources', context => LaunchProject.launch(context, testSpec, {},
        { registerListeners: client => client.on('loadedSource', args => onLoadedSource(<DebugProtocol.LoadedSourceEvent>args)) }), async launchProject => {
            await launchProject.pausedWizard.waitUntilPausedOnDebuggerStatement();
            expect(loadedSources.length).to.equal(4);
            expect(loadedSources[0].name).to.equal('app.js');
            expect(loadedSources[0].path).to.match(new RegExp('http://localhost:[0-9]+/app.js'));

            expect(loadedSources[1].name).to.match(/VM[0-9]+/);
            expect(loadedSources[1].path).to.match(/<eval>\\VM[0-9]+/);

            expect(loadedSources[2].name).to.equal('jsUtilities.js');
            expect(loadedSources[2].path).to.match(new RegExp('http://localhost:[0-9]+/jsUtilities.js'));

            // These are the 2 inline scripts in the .html file
            expect(loadedSources[3].name).to.match(new RegExp('localhost:[0-9]+'));
            expect(loadedSources[3].path).to.match(new RegExp('http://localhost:[0-9]+'));
        });


    testUsing('can get dynamic JavaScript file source', context => LaunchProject.launch(context, testSpec, {},
        { registerListeners: client => client.on('loadedSource', args => onLoadedSource(<DebugProtocol.LoadedSourceEvent>args)) }), async launchProject => {
            await launchProject.pausedWizard.waitUntilPausedOnDebuggerStatement();

            expect(loadedSources[0].name).to.equal('app.js');
            const contents = await launchProject.debugClient.sourceRequest({ source: { sourceReference: loadedSources[0].sourceReference }, sourceReference: 0 /** Not used. Backwards compatibility */ });
            expect(contents.success).to.equal(true);

            const appFileContents = await readFileP(testSpec.src('../app.js'));
            expect(contents.body.content).to.equal(appFileContents);
        });

    testUsing('can get dynamic .html file source', context => LaunchProject.launch(context, testSpec, {},
        { registerListeners: client => client.on('loadedSource', args => onLoadedSource(<DebugProtocol.LoadedSourceEvent>args)) }), async launchProject => {
            await launchProject.pausedWizard.waitUntilPausedOnDebuggerStatement();

            // We need to finish loading the .html file, so we can request it's source content
            await launchProject.pausedWizard.resume();

            expect(loadedSources[3].name).to.match(new RegExp('localhost:[0-9]+'));
            const contents = await launchProject.debugClient.sourceRequest({ source: { sourceReference: loadedSources[3].sourceReference }, sourceReference: 0 /** Not used. Backwards compatibility */ });
            expect(contents.success).to.equal(true);

            const appFileContents = await readFileP(testSpec.src('../index.html'));
            expect(contents.body.content).to.equal(appFileContents);
        });
});
