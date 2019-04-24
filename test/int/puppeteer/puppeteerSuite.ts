/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createServer } from 'http-server';
import * as puppeteer from 'puppeteer';
import * as testSetup from '../testSetup';
import { launchTestAdapter } from '../intTestSupport';
import { getPageByUrl, connectPuppeteer } from './puppeteerSupport';
import { FrameworkTestContext, TestProjectSpec, ReassignableFrameworkTestContext } from '../framework/frameworkTestSupport';
import { isThisV1 } from '../testSetup';
import { HttpOrHttpsServer } from '../types/server';
import { loadProjectLabels } from '../labels';
import { logCallsTo } from '../utils/logging';
import { ISuiteCallbackContext, ISuite } from 'mocha';

/**
 * Extends the normal debug adapter context to include context relevant to puppeteer tests.
 */
export interface IPuppeteerTestContext extends FrameworkTestContext {
  /** The connected puppeteer browser object */
  browser: puppeteer.Browser;
  /** The currently running html page in Chrome */
  page: puppeteer.Page;
}

export class PuppeteerTestContext extends ReassignableFrameworkTestContext {
  public constructor(public readonly browser: puppeteer.Browser, public readonly page: puppeteer.Page) {
    super();
  }
}

/**
 * Launch a test with default settings and attach puppeteer. The test will start with the debug adapter
 * and chrome launched, and puppeteer attached.
 *
 * @param description Describe what this test should be testing
 * @param context The test context for this test sutie
 * @param testFunction The inner test function that will run a test using puppeteer
 */
async function puppeteerTestFunction(
  description: string,
  context: FrameworkTestContext,
  testFunction: (context: PuppeteerTestContext, page: puppeteer.Page) => Promise<any>,
  functionToDeclareTest: (description: string, callback: (this: ISuiteCallbackContext) => void) => ISuite = test
) {
  return functionToDeclareTest(description, async function () {
    const debugClient = await context.debugClient;
    await launchTestAdapter(debugClient, context.testSpec.props.launchConfig);
    const browser = await connectPuppeteer(9222);

    const page = logCallsTo(await getPageByUrl(browser, context.testSpec.props.url), 'PuppeteerPage');

    // This short wait appears to be necessary to completely avoid a race condition in V1 (tried several other
    // strategies to wait deterministically for all scripts to be loaded and parsed, but have been unsuccessful so far)
    // If we don't wait here, there's always a possibility that we can send the set breakpoint request
    // for a subsequent test after the scripts have started being parsed/run by Chrome, yet before
    // the target script is parsed, in which case the adapter will try to use breakOnLoad, but
    // the instrumentation BP will never be hit, leaving our breakpoint in limbo
    if (isThisV1) {
      await new Promise(a => setTimeout(a, 500));
    }

    await testFunction( new PuppeteerTestContext(browser, page).reassignTo(context), page);
  });
}

puppeteerTestFunction.skip = (
  description: string,
  _context: FrameworkTestContext,
  _testFunction: (context: IPuppeteerTestContext, page: puppeteer.Page) => Promise<any>
) => test.skip(description, () => {throw new Error(`We don't expect this to be called`); });

puppeteerTestFunction.only = (
  description: string,
  context: FrameworkTestContext,
  testFunction: (context: IPuppeteerTestContext, page: puppeteer.Page) => Promise<any>
) => puppeteerTestFunction(description, context, testFunction, test.only);

export const puppeteerTest = puppeteerTestFunction;

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
function puppeteerSuiteFunction(
  description: string,
  testSpec: TestProjectSpec,
  callback: (suiteContext: FrameworkTestContext) => any,
  suiteFunctionToUse: (description: string, callback: (this: ISuiteCallbackContext) => void) => ISuite = suite
): Mocha.ISuite {
  return suiteFunctionToUse(description, () => {
    const suiteContext = new ReassignableFrameworkTestContext();

    let server: HttpOrHttpsServer | null;

    setup(async function () {
      let debugClient = await testSetup.setup(this);
      suiteContext.reassignTo({
        testSpec,
        debugClient: debugClient,
        breakpointLabels: await loadProjectLabels(testSpec.props.webRoot)
      });

      // Running tests on CI can time out at the default 5s, so we up this to 10s
      suiteContext.debugClient.defaultTimeout = 15000;

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

puppeteerSuiteFunction.only = (
  description: string,
  testSpec: TestProjectSpec,
  callback: (suiteContext: FrameworkTestContext) => any,
) => puppeteerSuiteFunction(description, testSpec, callback, suite.only);
export const puppeteerSuite = puppeteerSuiteFunction;