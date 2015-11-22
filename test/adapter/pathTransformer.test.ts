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
    const CLIENT_URL = 'c:/projects/mysite/scripts/script1.js';


    let utilsMock: Sinon.SinonMock;
    let transformer: _PathTransformer;

    setup(() => {
        testUtils.setupUnhandledRejectionListener();
        mockery.enable({ useCleanCache: true, warnOnReplace: false });
        mockery.registerAllowables([MODULE_UNDER_TEST, 'path']);

        // Mock the utils functions
        const mockedObj = testUtils.getDefaultUtilitiesMock();
        utilsMock = testUtils.getSinonMock(mockedObj);
        utilsMock.expects('webkitUrlToClientPath')
            .once()
            .withExactArgs(/*webRoot=*/undefined, TARGET_URL).returns(CLIENT_URL);

        mockery.registerMock('../webkit/utilities', mockedObj);
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
            SET_BP_ARGS = { source: { path: CLIENT_URL } };
        });

        test('resolves correctly when it can map the client script to the target script', () => {
            utilsMock.expects('canonicalizeUrl')
                .once()
                .withExactArgs(CLIENT_URL).returns(CLIENT_URL);

            transformer.scriptParsed(<any>{ body: { scriptUrl: TARGET_URL } });
            return transformer.setBreakpoints(<any>SET_BP_ARGS).then(() => {
                utilsMock.verify();
                assert.deepEqual(SET_BP_ARGS, EXPECTED_SET_BP_ARGS);
            });
        });

        test(`doesn't resolve until it can map the client script to the target script`, () => {
            utilsMock.expects('canonicalizeUrl')
                .twice()
                .withExactArgs(CLIENT_URL).returns(CLIENT_URL);

            const setBreakpointsP = transformer.setBreakpoints(<any>SET_BP_ARGS).then(() => {
                // If this assert doesn't fail, we know that it resolved at the right time because otherwise it would have no
                // way to produce args with the right url
                utilsMock.verify();
                assert.deepEqual(SET_BP_ARGS, EXPECTED_SET_BP_ARGS);
            });

            transformer.scriptParsed(<any>{ body: { scriptUrl: TARGET_URL } });

            return setBreakpointsP;
        });
    });

    suite('scriptParsed', () => {
        test('Modifies args.source.path of the script parsed event', () => {
            const scriptParsedArgs = <any>{ body: { scriptUrl: TARGET_URL } };
            const expectedScriptParsedArgs = <any>{ body: { scriptUrl: CLIENT_URL } };
            transformer.scriptParsed(scriptParsedArgs);
            assert.deepEqual(scriptParsedArgs, expectedScriptParsedArgs);
        });
    });
});