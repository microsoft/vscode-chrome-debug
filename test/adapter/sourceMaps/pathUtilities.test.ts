/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from 'assert';
import * as mockery from 'mockery';

import * as testUtils from '../../testUtils';

import {getAbsSourceRoot as _getAbsSourceRoot} from '../../../adapter/sourceMaps/pathUtilities';

const MODULE_UNDER_TEST = '../../../adapter/sourceMaps/pathUtilities';

suite('PathUtilities', () => {
    setup(() => {
        testUtils.setupUnhandledRejectionListener();

        // Set up mockery
        mockery.enable({ warnOnReplace: false, useCleanCache: true });
        mockery.registerAllowables([MODULE_UNDER_TEST, 'url', 'http', 'fs', '../../webkit/utilities']);
        testUtils.win32Mocks();
    });

    teardown(() => {
        testUtils.removeUnhandledRejectionListener();
        mockery.deregisterAll();
        mockery.disable();
    });


    suite('getAbsSourceRoot()', () => {
        const GEN_PATH = 'c:\\project\\webroot\\code\\script.js';
        const GEN_URL = 'http://localhost:8080/code/script.js';
        const ABS_SOURCEROOT = 'c:\\project\\src';
        const WEBROOT = 'c:/project/webroot';

        let getAbsSourceRoot: typeof _getAbsSourceRoot;
        setup(() => {
            getAbsSourceRoot = require(MODULE_UNDER_TEST).getAbsSourceRoot;
        });

        test('handles file:/// sourceRoot', () => {
            assert.equal(
                getAbsSourceRoot('file:///' + ABS_SOURCEROOT, WEBROOT, GEN_PATH),
                'c:\\project\\src');
        });

        test('handles /src style sourceRoot', () => {
            assert.equal(
                getAbsSourceRoot('/src', WEBROOT, GEN_PATH),
                'c:\\project\\webroot\\src');
        });

        test('handles ../../src style sourceRoot', () => {
            assert.equal(
                getAbsSourceRoot('../../src', WEBROOT, GEN_PATH),
                'c:\\project\\src');
        });

        test('handles src style sourceRoot', () => {
            assert.equal(
                getAbsSourceRoot('src', WEBROOT, GEN_PATH),
                'c:\\project\\webroot\\code\\src');
        });

        test('handles runtime script not on disk', () => {
            assert.equal(
                getAbsSourceRoot('../src', WEBROOT, GEN_URL),
                'c:\\project\\webroot\\src');
        });

        test('when no sourceRoot specified and runtime script is on disk, uses the runtime script dirname', () => {
            assert.equal(
                getAbsSourceRoot('', WEBROOT, GEN_PATH),
                'c:\\project\\webroot\\code');
        });

        test('when no sourceRoot specified and runtime script is not on disk, uses the runtime script dirname', () => {
            assert.equal(
                getAbsSourceRoot('', WEBROOT, GEN_URL),
                'c:\\project\\webroot\\code');
        });

        test('strips a trailing slash and uses lowercase drive letter', () => {
            assert.equal(
                getAbsSourceRoot('/src/', WEBROOT, 'C:' + GEN_PATH.substr(1)),
                'c:\\project\\webroot\\src');
        });
    });
});
