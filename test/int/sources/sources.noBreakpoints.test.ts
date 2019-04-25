import * as path from 'path';
import * as testSetup from '../testSetup';
import * as assert from 'assert';
import { puppeteerSuite, puppeteerTest } from '../puppeteer/puppeteerSuite';
import { TestProjectSpec } from '../framework/frameworkTestSupport';
import * as sourcesHelper from './sources.utils';
import { LoadedSourceEvent } from 'vscode-debugadapter';

// We are using the "Simple" project app inside the testdata directory
const DATA_ROOT = testSetup.DATA_ROOT;
const SIMPLE_PROJECT_ROOT = path.join(DATA_ROOT, 'simple');
const TEST_SPEC = new TestProjectSpec( { projectRoot: SIMPLE_PROJECT_ROOT } );
const sourceChecker = new sourcesHelper.SourcesChecker();

puppeteerSuite('Static HTML Pages Without Breakpoints', TEST_SPEC, (suiteContext) => {
    puppeteerTest('Receive loaded source events after page load', suiteContext, async (context, page) => {
        sourceChecker.resetLoadedSourcesCount();
        let dynamicScript1 = 'console.log(\'hello new page!\')';

        await Promise.all([
            page.addScriptTag({content: dynamicScript1}),
            context.debugClient.waitForEvent('loadedSource').then(event => {
                sourceChecker.assertNewSource(<LoadedSourceEvent>event);
                sourceChecker.updateSourcesCount(1);
                sourceChecker.assertLoadedSourceCountIs(1);
            })
        ]);

        let dynamicScript2 = 'console.log(\'hello again!\')';

        await Promise.all([
            page.evaluate(dynamicScript2),
            context.debugClient.waitForEvent('loadedSource').then(event => {
                sourceChecker.assertNewSource(<LoadedSourceEvent>event);
                sourceChecker.updateSourcesCount(1);
                sourceChecker.assertLoadedSourceCountIs(2);
            })
        ]);
    });

    puppeteerTest('Static webpage with single loaded script', suiteContext, async (context) => {
        let scriptToMatch = sourcesHelper.createScriptItemFromInfo('app.js', TEST_SPEC.props.url + 'app.js');
        let loadedSourcesResponse = await context.debugClient.loadedSources({});

        let hasScript = await sourcesHelper.loadedSourcesContainsScript(loadedSourcesResponse.sources, scriptToMatch);
        assert.equal(hasScript, true, "loaded sources does not contain given script");
    });

    puppeteerTest('Dynamically inject a script using evaluate', suiteContext, async (context, page) => {
        let loadedSourcesResponseBeforeInjection = await context.debugClient.loadedSources({});
        assert.equal(loadedSourcesResponseBeforeInjection.sources.length, 1, "loaded sources should only contain 1 source before script injection");

        let dynamicScriptContent = 'console.log(\'hello!\')';
        await page.evaluate(dynamicScriptContent);

        let loadedSourcesResponseAfterInjection = await suiteContext.debugClient.loadedSources({});
        assert.equal(loadedSourcesResponseAfterInjection.sources.length, 2, "loaded sources should have 2 sources after script injection");
    });

    puppeteerTest('Dynamically inject a script using script tag', suiteContext, async (context, page) => {
        let loadedSourcesResponseBeforeInjection = await context.debugClient.loadedSources({});
        assert.equal(loadedSourcesResponseBeforeInjection.sources.length, 1, "loaded sources should only contain 1 source before script injection");

        let dynamicScriptContent = 'console.log(\'hello!\')';
        await page.addScriptTag({content: dynamicScriptContent});

        let loadedSourcesResponseAfterInjection = await suiteContext.debugClient.loadedSources({});
        assert.equal(loadedSourcesResponseAfterInjection.sources.length, 2, "loaded sources should have 2 sources after script injection");
    });
});

