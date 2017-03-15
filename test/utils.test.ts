/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as mockery from 'mockery';
import * as assert from 'assert';

import * as testUtils from './testUtils';

/** Utils without mocks - use for type only */
import * as _Utils from '../src/utils';

const MODULE_UNDER_TEST = '../src/utils';
suite('Utils', () => {
    function getUtils(): typeof _Utils {
        return require(MODULE_UNDER_TEST);
    }

    setup(() => {
        testUtils.setupUnhandledRejectionListener();

        mockery.enable({ useCleanCache: true, warnOnReplace: false, warnOnUnregistered: false });
        mockery.registerMock('fs', { statSync: () => { } });
    });

    teardown(() => {
        testUtils.removeUnhandledRejectionListener();

        mockery.deregisterAll();
        mockery.disable();
    });

    suite('getBrowserPath()', () => {
        test('osx', () => {
            mockery.registerMock('os', { platform: () => 'darwin' });
            const Utils = getUtils();
            assert.equal(
                Utils.getBrowserPath(),
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
        });

        test('win', () => {
            // Overwrite the statSync mock to say the x86 path doesn't exist
            const statSync = (aPath: string) => {
                if (aPath.indexOf('(x86)') >= 0) throw new Error('Not found');
            };
            mockery.registerMock('fs', { statSync });
            mockery.registerMock('os', { platform: () => 'win32' });

            const Utils = getUtils();
            assert.equal(
                Utils.getBrowserPath(),
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
        });

        test('winx86', () => {
            mockery.registerMock('os', { platform: () => 'win32' });
            const Utils = getUtils();
            assert.equal(
                Utils.getBrowserPath(),
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe');
        });

        test('linux', () => {
            mockery.registerMock('os', { platform: () => 'linux' });
            const Utils = getUtils();
            assert.equal(
                Utils.getBrowserPath(),
                '/usr/bin/google-chrome');
        });

        test('freebsd (default to Linux for anything unknown)', () => {
            mockery.registerMock('os', { platform: () => 'freebsd' });
            const Utils = getUtils();
            assert.equal(
                Utils.getBrowserPath(),
                '/usr/bin/google-chrome');
        });
    });
});