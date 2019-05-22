/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { IFixture } from '../fixtures/fixture';
import { launchTestAdapter } from '../intTestSupport';
import { ExtendedDebugClient } from 'vscode-chrome-debug-core-testsupport';
import { connectPuppeteer, getPageByUrl } from './puppeteerSupport';
import { logCallsTo } from '../utils/logging';
import { isThisV1 } from '../testSetup';
import { TestProjectSpec } from '../framework/frameworkTestSupport';
import { Browser, Page } from 'puppeteer';

/**
 * Launch the debug adapter using the Puppeteer version of chrome, and then connect to it
 *
 * The fixture offers access to both the browser, and page objects of puppeteer
 */
export class LaunchPuppeteer implements IFixture {
    public constructor(public readonly browser: Browser, public readonly page: Page) { }

    public static async create(debugClient: ExtendedDebugClient, testSpec: TestProjectSpec): Promise<LaunchPuppeteer> {
        await launchTestAdapter(debugClient, testSpec.props.launchConfig);
        const browser = await connectPuppeteer(9222);

        const page = logCallsTo(await getPageByUrl(browser, testSpec.props.url), 'PuppeteerPage');

        // This short wait appears to be necessary to completely avoid a race condition in V1 (tried several other
        // strategies to wait deterministically for all scripts to be loaded and parsed, but have been unsuccessful so far)
        // If we don't wait here, there's always a possibility that we can send the set breakpoint request
        // for a subsequent test after the scripts have started being parsed/run by Chrome, yet before
        // the target script is parsed, in which case the adapter will try to use breakOnLoad, but
        // the instrumentation BP will never be hit, leaving our breakpoint in limbo
        if (isThisV1) {
            await new Promise(a => setTimeout(a, 500));
        }

        return new LaunchPuppeteer(browser, page);
    }

    public async cleanUp(): Promise<void> { }


    public toString(): string {
        return `LaunchPuppeteer`;
    }
}