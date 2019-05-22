
import * as path from 'path';
import * as testSetup from '../testSetup';
import { puppeteerSuite } from '../puppeteer/puppeteerSuite';
import { TestProjectSpec } from '../framework/frameworkTestSupport';
import { FrameworkTestSuite } from '../framework/frameworkCommonTests';

const DATA_ROOT = testSetup.DATA_ROOT;
const INLINE_SCRIPTS_PROJECT_ROOT = path.join(DATA_ROOT, 'inline_scripts');
const SINGLE_INLINE_TEST_SPEC = new TestProjectSpec( { projectRoot: INLINE_SCRIPTS_PROJECT_ROOT, url: `file:///${DATA_ROOT.replace(/\\/g, '/')}inline_scripts/single.html` } );
const MULTIPLE_INLINE_TEST_SPEC = new TestProjectSpec( { projectRoot: INLINE_SCRIPTS_PROJECT_ROOT, url: `file:///${DATA_ROOT.replace(/\\/g, '/')}inline_scripts/multiple.html` } );

suite('Inline Script Tests', () => {
    puppeteerSuite('Single inline script', SINGLE_INLINE_TEST_SPEC, (suiteContext) => {
        const frameworkTests = new FrameworkTestSuite('Simple JS', suiteContext);
        frameworkTests.genericBreakpointTest('Should stop on a breakpoint in an in-line script', 'actionButton', 'inlineScriptSingle1', page => page.click('#actionButton') );
    });

    puppeteerSuite.skip('Multiple inline scripts', MULTIPLE_INLINE_TEST_SPEC, (suiteContext) => {
        const frameworkTests = new FrameworkTestSuite('Simple JS', suiteContext);
        frameworkTests.genericBreakpointTest('Should stop on a breakpoint in multiple in-line scripts (Skipped, not currently working in V2)',
                'actionButton', 'inlineScript1', page => page.click('#actionButton') );
    });
});
