/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { PromiseOrNot } from 'vscode-chrome-debug-core';

/**
 * See https://en.wikipedia.org/wiki/Test_fixture for more context
 */

/**
 * A fixture represents a particular piece of set up of the context, or the environment or
 * the configuration needed for a test or suite to run.
 * The fixture should make those changes during it's constructor or static constructor method,
 * and it'll "clean up" those changes with the cleanUp method
 */
export interface IFixture {
    /** Clean-up the context, or changes made by the fixture */
    cleanUp(): PromiseOrNot<void>;
}

/**
 * A fixture representing that no setup is needed
 */
export class NullFixture implements IFixture {
    public cleanUp(): void { }
}
