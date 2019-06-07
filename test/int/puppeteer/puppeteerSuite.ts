/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as puppeteer from 'puppeteer';
import { FrameworkTestContext, TestProjectSpec, ReassignableFrameworkTestContext } from '../framework/frameworkTestSupport';
import { loadProjectLabels } from '../labels';
import { ISuiteCallbackContext, ISuite } from 'mocha';
import { NullFixture } from '../fixtures/fixture';
import { LaunchProject } from '../fixtures/launchProject';
import { PromiseOrNot } from 'vscode-chrome-debug-core';
import { logger } from 'vscode-debugadapter';
import { setTestLogName } from '../utils/logging';

/**
 * Extends the normal debug adapter context to include context relevant to puppeteer tests.
 */
export interface IPuppeteerTestContext extends FrameworkTestContext {
  /** The connected puppeteer browser object */
  browser: puppeteer.Browser | null;
  /** The currently running html page in Chrome */
  page: puppeteer.Page | null;
  launchProject: LaunchProject | null;
}

export class PuppeteerTestContext extends ReassignableFrameworkTestContext {
  private _browser: puppeteer.Browser | null = null;
  private _page: puppeteer.Page | null = null;
  private _launchProject: LaunchProject | null = null;

  public constructor() {
    super();
  }

  public get browser(): puppeteer.Browser | null {
    return this._browser;
  }

  public get page(): puppeteer.Page | null {
    return this._page;
  }

  public get launchProject(): LaunchProject | null {
    return this._launchProject;
  }

  public reassignTo(newWrapped: IPuppeteerTestContext): this {
    super.reassignTo(newWrapped);
    this._page = newWrapped.page;
    this._browser = newWrapped.browser;
    this._launchProject = newWrapped.launchProject;
    return this;
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
function puppeteerTestFunction(
  description: string,
  context: PuppeteerTestContext,
  testFunction: (context: PuppeteerTestContext, page: puppeteer.Page) => PromiseOrNot<void>,
  functionToDeclareTest: (description: string, callback: (this: ISuiteCallbackContext) => void) => ISuite = test
): void {
  functionToDeclareTest(description, function () {
    return testFunction(context, context.page!);
  });
}

puppeteerTestFunction.skip = (
  description: string,
  _context: PuppeteerTestContext,
  _testFunction: (context: IPuppeteerTestContext, page: puppeteer.Page) => Promise<any>
) => test.skip(description, () => { throw new Error(`We don't expect this to be called`); });

puppeteerTestFunction.only = (
  description: string,
  context: PuppeteerTestContext,
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
  callback: (suiteContext: PuppeteerTestContext) => void,
  suiteFunctionToUse: (description: string, callback: (this: ISuiteCallbackContext) => void) => ISuite | void = suite
): Mocha.ISuite | void {
  return suiteFunctionToUse(description, () => {
    let testContext = new PuppeteerTestContext();
    let fixture: LaunchProject | NullFixture = new NullFixture(); // This variable is shared across all test of this suite

    setup(async function () {
      setTestLogName(this.currentTest.fullTitle());
      const breakpointLabels = await loadProjectLabels(testSpec.props.webRoot);
      const launchProject = fixture = await LaunchProject.create(this, testSpec);

      testContext.reassignTo({
        testSpec, debugClient: launchProject.debugClient, breakpointLabels, browser: launchProject.browser, page: launchProject.page, launchProject
      });
    });

    teardown(async () => {
      await fixture.cleanUp();
      fixture = new NullFixture();
      logger.log(`teardown finished`);
    });

    callback(testContext);
  });
}

puppeteerSuiteFunction.skip = (
  description: string,
  testSpec: TestProjectSpec,
  callback: (suiteContext: PuppeteerTestContext) => any
) => puppeteerSuiteFunction(description, testSpec, callback, suite.skip);

puppeteerSuiteFunction.only = (
  description: string,
  testSpec: TestProjectSpec,
  callback: (suiteContext: PuppeteerTestContext) => any,
) => puppeteerSuiteFunction(description, testSpec, callback, suite.only);
puppeteerSuiteFunction.skip = (
  description: string,
  _testSpec: TestProjectSpec,
  _callback: (suiteContext: PuppeteerTestContext) => any,
) => suite.skip(description, () => {});
export const puppeteerSuite = puppeteerSuiteFunction;