/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createServer } from 'http-server';
import * as puppeteer from 'puppeteer';
import * as testSetup from '../testSetup';
import { launchTestAdapter } from '../intTestSupport';
import { firstPage, connectPuppeteer } from './puppeteerSupport';
import { FrameworkTestContext, TestProjectSpec } from '../framework/frameworkTestSupport';

/**
 * Extends the normal debug adapter context to include context relevant to puppeteer tests.
 */
export interface PuppeteerTestContext extends FrameworkTestContext {
    /** The connected puppeteer browser object */
    browser: puppeteer.Browser;
    /** The currently running html page in Chrome */
    page: puppeteer.Page;
}

/**
 * Launch a test with default settings and attach puppeteer. The test will start with the debug adapter
 * and chrome launched, and puppeteer attached.
 *
 * @param description Describe what this test should be testing
 * @param context The test context for this test sutie
 * @param testFunction The inner test function that will run a test using puppeteer
 */
export async function puppeteerTest(
    description: string,
    context: FrameworkTestContext,
    testFunction: (context: PuppeteerTestContext, page: puppeteer.Page) => Promise<any>
  ) {
    return test(description, async () => {
      let debugClient = await context.debugClient;
      await launchTestAdapter(debugClient, context.testSpec.props.launchConfig);
      let browser = await connectPuppeteer(9222);
      let page = await firstPage(browser);
      await testFunction({ ...context, browser, page}, page);
    });
  }

/**
 * Defines a custom test suite which will:
 *     1) automatically launch a server from a test project directory,
 *     2) launch the debug adapter (with chrome)
 *
 * From there, consumers can either launch a puppeteer instrumented test, or a normal test (i.e. without puppeteer) using
 * the test methods defined here, and can get access to the relevant variables.
 *
 * @param description Description for the mocha test suite
 * @param testSpec Info about the test project on which this suite will be based
 * @param callback The inner test suite that uses this context
 */
export function puppeteerSuite(
  description: string,
  testSpec: TestProjectSpec,
  callback: (suiteContext: FrameworkTestContext) => any
): Mocha.ISuite {
  return suite(description, () => {
    let suiteContext: FrameworkTestContext = { testSpec };

    let server: any;

    setup(async () => {
      suiteContext.debugClient = await testSetup.setup();
      await suiteContext.debugClient;
      server = createServer({ root: testSpec.props.webRoot });
      server.listen(7890);
    });

    teardown(() => {
      if (server) {
        server.close(err => console.log('Error closing server in teardown: ' + (err && err.message)));
        server = null;
      }
      return testSetup.teardown();
    });

    callback(suiteContext);
  });
}
