/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as mockery from 'mockery';
import * as assert from 'assert';

/** Utilities without mocks - use for type only */
import * as _Utilities from '../../webkit/utilities';

class FSMock {
    /** Throws if the path doesn't exist */
    public statSync(path: string): void { }
}

const MODULE_UNDER_TEST = '../../webkit/utilities';
suite('Utilities', () => {
    suite('getPlatform()/getBrowserPath()', () => {
        const fsMock = new FSMock();

        setup(() => {
            // Set up mockery with SourceMaps mock
            mockery.enable({ useCleanCache: true });
            mockery.registerMock('fs', fsMock);
            mockery.registerAllowable(MODULE_UNDER_TEST);
        });

        teardown(() => {
            mockery.deregisterAll();
            mockery.disable();
        });

        test('osx', () => {
            mockery.registerMock('os', { platform: () => 'darwin' });
            let Utilities: typeof _Utilities = require(MODULE_UNDER_TEST);
            assert.equal(Utilities.getPlatform(), Utilities.Platform.OSX);
            assert.equal(
                Utilities.getBrowserPath(),
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
        });

        test('win', () => {
            mockery.registerMock('os', { platform: () => 'win32' });

            // Overwrite the statSync mock to say the x86 path doesn't exist
            fsMock.statSync = (path: string) => {
                if (path.indexOf('(x86)') >= 0) throw new Error('Not found');
            };

            let Utilities: typeof _Utilities = require(MODULE_UNDER_TEST);
            assert.equal(Utilities.getPlatform(), Utilities.Platform.Windows);
            assert.equal(
                Utilities.getBrowserPath(),
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
        });

        test('winx86', () => {
            mockery.registerMock('os', { platform: () => 'win32' });
            let Utilities: typeof _Utilities = require(MODULE_UNDER_TEST);
            assert.equal(Utilities.getPlatform(), Utilities.Platform.Windows);
            assert.equal(
                Utilities.getBrowserPath(),
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe');
        });

        test('linux', () => {
            mockery.registerMock('os', { platform: () => 'linux' });
            let Utilities: typeof _Utilities = require(MODULE_UNDER_TEST);
            assert.equal(Utilities.getPlatform(), Utilities.Platform.Linux);
            assert.equal(
                Utilities.getBrowserPath(),
                '/usr/bin/google-chrome');
        });

        test('freebsd (default to Linux for anything unknown)', () => {
            mockery.registerMock('os', { platform: () => 'freebsd' });
            let Utilities: typeof _Utilities = require(MODULE_UNDER_TEST);
            assert.equal(Utilities.getPlatform(), Utilities.Platform.Linux);
            assert.equal(
                Utilities.getBrowserPath(),
                '/usr/bin/google-chrome');
        });
    });

    suite('reversedArr', () => {

    });
});
