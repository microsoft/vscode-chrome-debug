/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from 'assert';
import * as mockery from 'mockery';

import * as testUtils from '../testUtils';
import {PathTransformer as _PathTransformer} from '../../src/transformers/pathTransformer';
import * as chromeUtils from '../../src/chrome/chromeUtils';

// As of 0.1.0, the included .d.ts is not in the right format to use the import syntax here
// https://github.com/florinn/typemoq/issues/4
// const typemoq: ITypeMoqStatic = require('typemoq');

import {Mock, MockBehavior, It} from 'typemoq';

const MODULE_UNDER_TEST = '../../src/transformers/pathTransformer';
function createTransformer(): _PathTransformer {
    return new (require(MODULE_UNDER_TEST).PathTransformer)();
}

suite('PathTransformer', () => {
    const TARGET_URL = 'http://mysite.com/scripts/script1.js';
    const CLIENT_PATH = testUtils.pathResolve('/projects/mysite/scripts/script1.js');

    let chromeUtilsMock: Mock<typeof chromeUtils>;
    let transformer: _PathTransformer;

    setup(() => {
        testUtils.setupUnhandledRejectionListener();
        mockery.enable({ useCleanCache: true, warnOnReplace: false, warnOnUnregistered: false });

        chromeUtilsMock = Mock.ofInstance(chromeUtils, MockBehavior.Strict);
        mockery.registerMock('../chrome/chromeUtils', chromeUtilsMock.object);

        transformer = createTransformer();
    });

    teardown(() => {
        testUtils.removeUnhandledRejectionListener();
        mockery.deregisterAll();
        mockery.disable();

        chromeUtilsMock.verifyAll();
    });

    suite('setBreakpoints()', () => {
        let SET_BP_ARGS;
        const EXPECTED_SET_BP_ARGS = { source: { path: TARGET_URL } };

        setup(() => {
            // This will be modified by the test, so restore it before each
            SET_BP_ARGS = { source: { path: CLIENT_PATH } };
        });

        test('resolves correctly when it can map the client script to the target script', () => {
            chromeUtilsMock
                .setup(x => x.targetUrlToClientPath(It.isValue(undefined), It.isValue(TARGET_URL)))
                .returns(() => CLIENT_PATH).verifiable();

            transformer.scriptParsed(<any>{ body: { scriptUrl: TARGET_URL } });
            return transformer.setBreakpoints(<any>SET_BP_ARGS).then(() => {
                assert.deepEqual(SET_BP_ARGS, EXPECTED_SET_BP_ARGS);
            });
        });

        test(`doesn't resolve until it can map the client script to the target script`, () => {
            chromeUtilsMock
                .setup(x => x.targetUrlToClientPath(It.isValue(undefined), It.isValue(TARGET_URL)))
                .returns(() => CLIENT_PATH).verifiable();

            const setBreakpointsP = transformer.setBreakpoints(<any>SET_BP_ARGS).then(() => {
                // If this assert doesn't fail, we know that it resolved at the right time because otherwise it would have no
                // way to produce args with the right url
                assert.deepEqual(SET_BP_ARGS, EXPECTED_SET_BP_ARGS);
            });

            transformer.scriptParsed(<any>{ body: { scriptUrl: TARGET_URL } });
            return setBreakpointsP;
        });

        test(`uses path as-is when it's a URL`, () => {
            const args = <any>{ source: { path: TARGET_URL } };
            return transformer.setBreakpoints(args).then(() => {
                assert.deepEqual(args, EXPECTED_SET_BP_ARGS);
            });
        });
    });

    suite('scriptParsed', () => {
        test('modifies args.source.path of the script parsed event when the file can be mapped', () => {
            chromeUtilsMock
                .setup(x => x.targetUrlToClientPath(It.isValue(undefined), It.isValue(TARGET_URL)))
                .returns(() => CLIENT_PATH).verifiable();

            const scriptParsedArgs = <any>{ body: { scriptUrl: TARGET_URL } };
            const expectedScriptParsedArgs = <any>{ body: { scriptUrl: CLIENT_PATH } };
            transformer.scriptParsed(scriptParsedArgs);
            assert.deepEqual(scriptParsedArgs, expectedScriptParsedArgs);
        });

        test(`doesn't modify args.source.path when the file can't be mapped`, () => {
            chromeUtilsMock
                .setup(x => x.targetUrlToClientPath(It.isValue(undefined), It.isValue(TARGET_URL)))
                .returns(() => '').verifiable();

            const scriptParsedArgs = <any>{ body: { scriptUrl: TARGET_URL } };
            const expectedScriptParsedArgs = <any>{ body: { scriptUrl: TARGET_URL } };
            transformer.scriptParsed(scriptParsedArgs);
            assert.deepEqual(scriptParsedArgs, expectedScriptParsedArgs);
        });
    });

    suite('stackTraceResponse()', () => {
        const RUNTIME_LINES = [2, 5, 8];

        test('modifies the source path and clears sourceReference when the file can be mapped', () => {
            chromeUtilsMock
                .setup(x => x.targetUrlToClientPath(It.isValue(undefined), It.isValue(TARGET_URL)))
                .returns(() => CLIENT_PATH).verifiable();

            const response = testUtils.getStackTraceResponseBody(TARGET_URL, RUNTIME_LINES, [1, 2, 3]);
            const expectedResponse = testUtils.getStackTraceResponseBody(CLIENT_PATH, RUNTIME_LINES);

            transformer.stackTraceResponse(response);
            assert.deepEqual(response, expectedResponse);
        });

        test(`doesn't modify the source path or clear the sourceReference when the file can't be mapped`, () => {
            chromeUtilsMock
                .setup(x => x.targetUrlToClientPath(It.isValue(undefined), It.isValue(TARGET_URL)))
                .returns(() => '').verifiable();

            const response = testUtils.getStackTraceResponseBody(TARGET_URL, RUNTIME_LINES, [1, 2, 3]);
            const expectedResponse = testUtils.getStackTraceResponseBody(TARGET_URL, RUNTIME_LINES, [1, 2, 3]);

            transformer.stackTraceResponse(response);
            assert.deepEqual(response, expectedResponse);
        });
    });
});