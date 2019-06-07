/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { IFixture } from './fixture';
import { PromiseOrNot } from 'vscode-chrome-debug-core';
import { ITestCallbackContext } from 'mocha';

/** Run a test doing the setup/cleanup indicated by the provided fixtures */
function testUsingFunction<T extends IFixture>(
    expectation: string,
    fixtureProvider: (context: ITestCallbackContext) => PromiseOrNot<T>,
    testFunction: (fixtures: T) => Promise<void>): Mocha.ITest {
    return test(expectation, async function () {
        const fixture = await fixtureProvider(this);
        try {
            await testFunction(fixture);
        } finally {
            await fixture.cleanUp();
        }
    });
}

export const testUsing = testUsingFunction;
