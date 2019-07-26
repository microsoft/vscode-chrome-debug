/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as getPort from 'get-port';
import { IFixture } from '../fixtures/fixture';
import { launchTestAdapter, IScenarioConfiguration, IDebugAdapterCallbacks } from '../intTestSupport';
import { ExtendedDebugClient } from 'vscode-chrome-debug-core-testsupport';
import { connectPuppeteer, getPageByUrl, launchPuppeteer } from './puppeteerSupport';
import { logCallsTo } from '../utils/logging';
import { isThisV1 } from '../testSetup';
import { Browser, Page } from 'puppeteer';
import { logger } from 'vscode-debugadapter';
import { utils } from 'vscode-chrome-debug-core';

/**
 * Launch the debug adapter using the Puppeteer version of chrome, and then connect to it
 *
 * The fixture offers access to both the browser, and page objects of puppeteer
 */
export class LaunchPuppeteer implements IFixture {
    public constructor(public readonly browser: Browser, public readonly page: Page) { }

    public static async start(
        debugClient: ExtendedDebugClient, daConfig: IScenarioConfiguration, chromeArgs: string[] = [],
        callbacks: IDebugAdapterCallbacks): Promise<LaunchPuppeteer> {
        const daPort = await getPort();
        logger.log(`About to ${daConfig.scenario} debug-adapter at port: ${daPort}`);

        let browser: Browser;
        if (daConfig.scenario === 'launch') {
            await launchTestAdapter(debugClient, Object.assign({}, daConfig, { port: daPort }), callbacks);
            browser = await connectPuppeteer(daPort);
        } else {
            browser = await launchPuppeteer(daPort, chromeArgs);

            // We want to attach after the page is fully loaded, and things happened, to simulate a real attach scenario. So we wait for a little bit
            await utils.promiseTimeout(undefined, 3000);

            await launchTestAdapter(debugClient, Object.assign({}, daConfig, { port: daPort }), callbacks);
        }

        const page = logCallsTo(await getPageByUrl(browser, daConfig.url!), 'PuppeteerPage');

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

    public async cleanUp(): Promise<void> {
        logger.log(`Closing puppeteer and chrome`);
        try {
            await this.browser.close();
            logger.log(`Scucesfully closed puppeteer and chrome`);
        } catch (exception) {
            logger.log(`Failed to close puppeteer: ${exception}`);
        }
    }


    public toString(): string {
        return `LaunchPuppeteer`;
    }
}