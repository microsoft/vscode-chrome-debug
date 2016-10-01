/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from 'assert';
import * as mockery from 'mockery';

import * as testUtils from '../testUtils';
import {UrlPathTransformer as _UrlPathTransformer} from '../../src/transformers/urlPathTransformer';
import * as chromeUtils from '../../src/chrome/chromeUtils';

// As of 0.1.0, the included .d.ts is not in the right format to use the import syntax here
// https://github.com/florinn/typemoq/issues/4
// const typemoq: ITypeMoqStatic = require('typemoq');

import {Mock, MockBehavior, It} from 'typemoq';

const MODULE_UNDER_TEST = '../../src/transformers/urlPathTransformer';
function createTransformer(): _UrlPathTransformer {
    return new (require(MODULE_UNDER_TEST).UrlPathTransformer)();
}

suite('UrlPathTransformer', () => {
    const TARGET_URL = 'http://mysite.com/scripts/script1.js';
    const CLIENT_PATH = testUtils.pathResolve('/projects/mysite/scripts/script1.js');

    let chromeUtilsMock: Mock<typeof chromeUtils>;
    let transformer: _UrlPathTransformer;

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

            transformer.scriptParsed(TARGET_URL);
            assert(transformer.setBreakpoints(<any>SET_BP_ARGS));
            assert.deepEqual(SET_BP_ARGS, EXPECTED_SET_BP_ARGS);
        });

        test(`doesn't modify the args when it can't map the client script to the target script`, () => {
            const origArgs = JSON.parse(JSON.stringify(SET_BP_ARGS));
            transformer.setBreakpoints(<any>SET_BP_ARGS);
            assert.deepEqual(SET_BP_ARGS, origArgs);
        });

        test(`uses path as-is when it's a URL`, () => {
            const args = <any>{ source: { path: TARGET_URL } };
            assert(transformer.setBreakpoints(args));
            assert.deepEqual(args, EXPECTED_SET_BP_ARGS);
        });
    });

    suite('scriptParsed', () => {
        test('returns the client path when the file can be mapped', () => {
            chromeUtilsMock
                .setup(x => x.targetUrlToClientPath(It.isValue(undefined), It.isValue(TARGET_URL)))
                .returns(() => CLIENT_PATH).verifiable();

            assert.deepEqual(transformer.scriptParsed(TARGET_URL), CLIENT_PATH);
        });

        test(`returns the given path when the file can't be mapped`, () => {
            chromeUtilsMock
                .setup(x => x.targetUrlToClientPath(It.isValue(undefined), It.isValue(TARGET_URL)))
                .returns(() => '').verifiable();

            assert.deepEqual(transformer.scriptParsed(TARGET_URL), TARGET_URL);
        });
    });

    suite('stackTraceResponse()', () => {
        const RUNTIME_LOCATIONS = [
            { line: 2, column: 3 },
            { line: 5, column: 6 },
            { line: 8, column: 9 }
        ];

        test('modifies the source path and clears sourceReference when the file can be mapped', () => {
            chromeUtilsMock
                .setup(x => x.targetUrlToClientPath(It.isValue(undefined), It.isValue(TARGET_URL)))
                .returns(() => CLIENT_PATH).verifiable();

            const response = testUtils.getStackTraceResponseBody(TARGET_URL, RUNTIME_LOCATIONS, [1, 2, 3]);
            const expectedResponse = testUtils.getStackTraceResponseBody(CLIENT_PATH, RUNTIME_LOCATIONS);

            transformer.stackTraceResponse(response);
            assert.deepEqual(response, expectedResponse);
        });

        test(`doesn't modify the source path or clear the sourceReference when the file can't be mapped`, () => {
            chromeUtilsMock
                .setup(x => x.targetUrlToClientPath(It.isValue(undefined), It.isValue(TARGET_URL)))
                .returns(() => '').verifiable();

            const response = testUtils.getStackTraceResponseBody(TARGET_URL, RUNTIME_LOCATIONS, [1, 2, 3]);
            const expectedResponse = testUtils.getStackTraceResponseBody(TARGET_URL, RUNTIME_LOCATIONS, [1, 2, 3]);

            transformer.stackTraceResponse(response);
            assert.deepEqual(response, expectedResponse);
        });
    });
});