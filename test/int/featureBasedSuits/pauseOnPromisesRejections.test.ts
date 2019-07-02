/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { testUsing } from '../fixtures/testUsing';
import { TestProjectSpec } from '../framework/frameworkTestSupport';
import { LaunchProject } from '../fixtures/launchProject';
import { expect } from 'chai';
import { THREAD_ID } from 'vscode-chrome-debug-core-testsupport';

testUsing('Pause on promise rejections when unhandled exceptions are enabled', context => LaunchProject.create(context,
    TestProjectSpec.fromTestPath('featuresTests/pauseOnPromisesRejections'),
    debugClient => debugClient.setExceptionBreakpointsRequest({ 'filters': ['uncaught'] })),
    async launchProject => {
        await waitUntilPausedOnPromiseRejection(launchProject, `Things didn't go as expected`);
    });

/** Wait and block until the debuggee is paused on an unhandled promise */
async function waitUntilPausedOnPromiseRejection(launchProject: LaunchProject, exceptionMessage: string): Promise<void> {
    return launchProject.pausedWizard.waitAndConsumePausedEvent(async pauseInfo => {
        expect(pauseInfo.description).to.equal('Paused on promise rejection');
        expect(pauseInfo.reason).to.equal('exception');

        const exceptionInfo = await launchProject.debugClient.exceptionInfoRequest({ threadId: THREAD_ID });
        validateExceptionHasCorrectInformation(exceptionInfo, exceptionMessage);
    });
}

function validateExceptionHasCorrectInformation(exceptionInfo, exceptionMessage: string) {
    expect(exceptionInfo.success).to.equal(true);
    expect(exceptionInfo.body.breakMode).to.equal('unhandled');
    expect(exceptionInfo.body.description).to.equal(undefined);
    expect(exceptionInfo.body.details).to.not.equal(undefined);
    expect(exceptionInfo.body.details!.message).to.equal(exceptionMessage);
    expect(exceptionInfo.body.exceptionId).to.equal('string');
    // formattedDescription is a VS-specific property
    expect((<any>exceptionInfo.body.details).formattedDescription).to.equal(exceptionMessage);
}
