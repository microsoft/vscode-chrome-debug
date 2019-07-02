/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import * as testSetup from '../testSetup';
import { puppeteerSuite } from '../puppeteer/puppeteerSuite';
import { TestProjectSpec } from '../framework/frameworkTestSupport';
import { FrameworkTestSuite } from '../framework/frameworkCommonTests';
import * as path from 'path';
import { utils } from 'vscode-chrome-debug-core';

const SINGLE_INLINE_TEST_SPEC = TestProjectSpec.fromTestPath('inline_scripts', '', utils.pathToFileURL(path.join(testSetup.DATA_ROOT, 'inline_scripts/single.html')));
const MULTIPLE_INLINE_TEST_SPEC = TestProjectSpec.fromTestPath('inline_scripts', '', utils.pathToFileURL(path.join(testSetup.DATA_ROOT, 'inline_scripts/multiple.html')));

suite('Inline Script Tests', () => {
    puppeteerSuite('Single inline script', SINGLE_INLINE_TEST_SPEC, (suiteContext) => {
        const frameworkTests = new FrameworkTestSuite('Simple JS', suiteContext);
        frameworkTests.testBreakpointHitsOnPageAction('Should stop on a breakpoint in an in-line script', '#actionButton', 'single.html', 'a + b;', page => page.click('#actionButton') );
    });

    puppeteerSuite.skip('Multiple inline scripts', MULTIPLE_INLINE_TEST_SPEC, (suiteContext) => {
        const frameworkTests = new FrameworkTestSuite('Simple JS', suiteContext);
        frameworkTests.testBreakpointHitsOnPageAction('Should stop on a breakpoint in multiple in-line scripts (Skipped, not currently working in V2)',
                '#actionButton', 'multiple.html', 'inlineScript1', page => page.click('#actionButton') );
    });
});
