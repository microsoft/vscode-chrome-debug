/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from 'assert';
import * as mockery from 'mockery';

import * as testUtils from '../testUtils';

import {PathTransformer as _PathTransformer} from '../../adapter/pathTransformer';

const MODULE_UNDER_TEST = '../../adapter/pathTransformer';
function createTransformer(): _PathTransformer {
    return new (require(MODULE_UNDER_TEST).PathTransformer)();
}

suite('PathTransformer', () => {
    const TARGET_URL = 'http://mysite.com/scripts/script1.js';
    const CLIENT_PATH = 'c:/projects/mysite/scripts/script1.js';


    let utilsMock: Sinon.SinonMock;
    let transformer: _PathTransformer;

    setup(() => {
        testUtils.setupUnhandledRejectionListener();
        mockery.enable({ useCleanCache: true, warnOnReplace: false });
        mockery.registerAllowables([MODULE_UNDER_TEST, 'path']);

        // Mock the utils functions
        utilsMock = testUtils.createRegisteredSinonMock('../webkit/utilities', testUtils.getDefaultUtilitiesMock());
        transformer = createTransformer();
    });

    teardown(() => {
        testUtils.removeUnhandledRejectionListener();
        mockery.deregisterAll();
        mockery.disable();
    });

    suite('setBreakpoints()', () => {
        let SET_BP_ARGS;
        const EXPECTED_SET_BP_ARGS = { source: { path: TARGET_URL } };

        setup(() => {
            // This will be modified by the test, so restore it before each
            SET_BP_ARGS = { source: { path: CLIENT_PATH } };
        });

        test('resolves correctly when it can map the client script to the target script', () => {
            utilsMock.expects('webkitUrlToClientPath')
                .withExactArgs(/*webRoot=*/undefined, TARGET_URL).returns(CLIENT_PATH);
            utilsMock.expects('canonicalizeUrl')
                .returns(CLIENT_PATH);
            utilsMock.expects('isURL')
                .withExactArgs(CLIENT_PATH).returns(false);

            transformer.scriptParsed(<any>{ body: { scriptUrl: TARGET_URL } });
            return transformer.setBreakpoints(<any>SET_BP_ARGS).then(() => {
                utilsMock.verify();
                assert.deepEqual(SET_BP_ARGS, EXPECTED_SET_BP_ARGS);
            });
        });

        test(`doesn't resolve until it can map the client script to the target script`, () => {
            utilsMock.expects('webkitUrlToClientPath')
                .withExactArgs(/*webRoot=*/undefined, TARGET_URL).returns(CLIENT_PATH);
            utilsMock.expects('canonicalizeUrl')
                .twice()
                .returns(CLIENT_PATH);
            utilsMock.expects('isURL')
                .twice()
                .withArgs(CLIENT_PATH).returns(false);

            const setBreakpointsP = transformer.setBreakpoints(<any>SET_BP_ARGS).then(() => {
                // If this assert doesn't fail, we know that it resolved at the right time because otherwise it would have no
                // way to produce args with the right url
                utilsMock.verify();
                assert.deepEqual(SET_BP_ARGS, EXPECTED_SET_BP_ARGS);
            });

            transformer.scriptParsed(<any>{ body: { scriptUrl: TARGET_URL } });

            return setBreakpointsP;
        });

        test(`uses path as-is when it's a URL`, () => {
            utilsMock.expects('isURL')
                .withExactArgs(TARGET_URL).returns(true);

            const args = <any>{ source: { path: TARGET_URL } };
            return transformer.setBreakpoints(args).then(() => {
                utilsMock.verify();
                assert.deepEqual(args, EXPECTED_SET_BP_ARGS);
            });
        });
    });

    suite('scriptParsed', () => {
        test('modifies args.source.path of the script parsed event when the file can be mapped', () => {
            utilsMock.expects('webkitUrlToClientPath')
                .withExactArgs(/*webRoot=*/undefined, TARGET_URL).returns(CLIENT_PATH);

            const scriptParsedArgs = <any>{ body: { scriptUrl: TARGET_URL } };
            const expectedScriptParsedArgs = <any>{ body: { scriptUrl: CLIENT_PATH } };
            transformer.scriptParsed(scriptParsedArgs);
            assert.deepEqual(scriptParsedArgs, expectedScriptParsedArgs);
        });

        test(`doesn't modify args.source.path when the file can't be mapped`, () => {
            utilsMock.expects('webkitUrlToClientPath')
                .withExactArgs(/*webRoot=*/undefined, TARGET_URL).returns('');

            const scriptParsedArgs = <any>{ body: { scriptUrl: TARGET_URL } };
            const expectedScriptParsedArgs = <any>{ body: { scriptUrl: TARGET_URL } };
            transformer.scriptParsed(scriptParsedArgs);
            assert.deepEqual(scriptParsedArgs, expectedScriptParsedArgs);
        });
    });

    suite('stackTraceResponse()', () => {
        const RUNTIME_LINES = [2, 5, 8];

        test('modifies the source path and clears sourceReference when the file can be mapped', () => {
            utilsMock.expects('webkitUrlToClientPath')
                .thrice()
                .withExactArgs(undefined, TARGET_URL).returns(CLIENT_PATH);

            const response = testUtils.getStackTraceResponseBody(TARGET_URL, RUNTIME_LINES, [1, 2, 3]);
            const expectedResponse = testUtils.getStackTraceResponseBody(CLIENT_PATH, RUNTIME_LINES);

            transformer.stackTraceResponse(response);
            assert.deepEqual(response, expectedResponse);
        });

        test(`doesn't modify the source path or clear the sourceReference when the file can't be mapped`, () => {
            utilsMock.expects('webkitUrlToClientPath')
                .thrice()
                .withExactArgs(undefined, TARGET_URL).returns('');

            const response = testUtils.getStackTraceResponseBody(TARGET_URL, RUNTIME_LINES, [1, 2, 3]);
            const expectedResponse = testUtils.getStackTraceResponseBody(TARGET_URL, RUNTIME_LINES, [1, 2, 3]);

            transformer.stackTraceResponse(response);
            assert.deepEqual(response, expectedResponse);
        });
    });
});