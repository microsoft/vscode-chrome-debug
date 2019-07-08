/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { IFixture } from './fixture';
import { ExtendedDebugClient } from 'vscode-chrome-debug-core-testsupport';
import * as testSetup from '../testSetup';
import { IBeforeAndAfterContext, ITestCallbackContext } from 'mocha';
import { logger } from 'vscode-debugadapter';

/**
 * Default set up for all our tests. We expect all our tests to need to do this setup
 * which includes configure the debug adapter, logging, etc...
 */
export class DefaultFixture implements IFixture {
    private constructor(public readonly debugClient: ExtendedDebugClient) {
        // Running tests on CI can time out at the default 5s, so we up this to 15s
        debugClient.defaultTimeout = 15000;
    }

    /** Create a new fixture using the provided setup context */
    public static async create(context: IBeforeAndAfterContext | ITestCallbackContext): Promise<DefaultFixture> {
        return new DefaultFixture(await testSetup.setup(context));
    }

    /** Create a new fixture using the full title of the test case currently running */
    public static async createWithTitle(testTitle: string): Promise<DefaultFixture> {
        return new DefaultFixture(await testSetup.setupWithTitle(testTitle));
    }

    public async cleanUp(): Promise<void> {
        logger.log(`Default test clean-up`);
        await testSetup.teardown();
        logger.log(`Default test clean-up finished`);
    }

    public toString(): string {
        return `DefaultFixture`;
    }
}