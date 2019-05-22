/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { IFixture } from './fixture';
import { PromiseOrNot } from 'vscode-chrome-debug-core';

/** Run a test doing the setup/cleanup indicated by the provided fixtures */
async function testUsingFunction<T extends IFixture>(
    expectation: string,
    fixtureProvider: () => PromiseOrNot<T>,
    testFunction: (fixtures: T) => Promise<void>) {
    return test(expectation, async function () {
        const fixture = await fixtureProvider();
        try {
            await testFunction(fixture);
        } finally {
            await fixture.cleanUp();
        }
    });
}

export const testUsing = testUsingFunction;
