/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as mockery from 'mockery';
import * as assert from 'assert';

/** Utilities without mocks - use for type only */
import * as _Utilities from '../../webkit/utilities';

const MODULE_UNDER_TEST = '../../webkit/utilities';
suite('Utilities', () => {
    setup(() => {
        mockery.enable({ useCleanCache: true, warnOnReplace: false });
        mockery.registerMock('fs', { statSync: () => { } });
        mockery.registerMock('os', { platform: () => 'win32' });
        mockery.registerMock('url', { });
        mockery.registerMock('path', { });
        mockery.registerAllowable(MODULE_UNDER_TEST);
    });

    teardown(() => {
        mockery.deregisterAll();
        mockery.disable();
    });

    suite('getPlatform()/getBrowserPath()', () => {
        test('osx', () => {
            mockery.registerMock('os', { platform: () => 'darwin' });
            const Utilities: typeof _Utilities = require(MODULE_UNDER_TEST);
            assert.equal(Utilities.getPlatform(), Utilities.Platform.OSX);
            assert.equal(
                Utilities.getBrowserPath(),
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
        });

        test('win', () => {
            // Overwrite the statSync mock to say the x86 path doesn't exist
            const statSync = (path: string) => {
                if (path.indexOf('(x86)') >= 0) throw new Error('Not found');
            };
            mockery.registerMock('fs', { statSync });

            const Utilities: typeof _Utilities = require(MODULE_UNDER_TEST);
            assert.equal(Utilities.getPlatform(), Utilities.Platform.Windows);
            assert.equal(
                Utilities.getBrowserPath(),
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
        });

        test('winx86', () => {
            const Utilities: typeof _Utilities = require(MODULE_UNDER_TEST);
            assert.equal(Utilities.getPlatform(), Utilities.Platform.Windows);
            assert.equal(
                Utilities.getBrowserPath(),
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe');
        });

        test('linux', () => {
            mockery.registerMock('os', { platform: () => 'linux' });
            const Utilities: typeof _Utilities = require(MODULE_UNDER_TEST);
            assert.equal(Utilities.getPlatform(), Utilities.Platform.Linux);
            assert.equal(
                Utilities.getBrowserPath(),
                '/usr/bin/google-chrome');
        });

        test('freebsd (default to Linux for anything unknown)', () => {
            mockery.registerMock('os', { platform: () => 'freebsd' });
            const Utilities: typeof _Utilities = require(MODULE_UNDER_TEST);
            assert.equal(Utilities.getPlatform(), Utilities.Platform.Linux);
            assert.equal(
                Utilities.getBrowserPath(),
                '/usr/bin/google-chrome');
        });
    });

    suite('existsSync()', () => {
        test('it returns false when statSync throws', () => {
            const statSync = (path: string) => {
                if (path.indexOf('notfound') >= 0) throw new Error('Not found');
            };
            mockery.registerMock('fs', { statSync });

            const Utilities: typeof _Utilities = require(MODULE_UNDER_TEST);
            assert.equal(Utilities.existsSync('exists'), true);
            assert.equal(Utilities.existsSync('thisfilenotfound'), false);
        });
    });

    suite('reversedArr()', () => {
        const Utilities: typeof _Utilities = require(MODULE_UNDER_TEST);

        test('it does not modify the input array', () => {
            let arr = [2, 4, 6];
            Utilities.reversedArr(arr);
            assert.deepEqual(arr, [2, 4, 6]);

            arr = [1];
            Utilities.reversedArr(arr);
            assert.deepEqual(arr, [1]);
        });

        test('it reverses the array', () => {
            assert.deepEqual(Utilities.reversedArr([1, 3, 5, 7]), [7, 5, 3, 1]);
            assert.deepEqual(
                Utilities.reversedArr([-1, 'hello', null, undefined, [1, 2]]),
                [[1, 2], undefined, null, 'hello', -1]);
        });
    });

    suite('promiseTimeout()', () => {
        const Utilities: typeof _Utilities = require(MODULE_UNDER_TEST);

        test('when given a promise it fails if the promise never resolves', done => {
            Utilities.promiseTimeout(new Promise(() => { }), 5).then(
                () => assert.fail('This promise should fail'),
                e => done()
            );
        });

        test('when given a promise it succeeds if the promise resolves', done => {
            Utilities.promiseTimeout(Promise.resolve('test'), 5).then(
                result => {
                    assert.equal(result, 'test');
                    done();
                },
                e => assert.fail('This promise should pass')
            );
        });

        test('when not given a promise it resolves', done => {
            Utilities.promiseTimeout(null, 5).then(
                done,
                () => assert.fail('This promise should pass')
            );
        });
    });

    suite('retryAsync()', () => {
        const Utilities: typeof _Utilities = require(MODULE_UNDER_TEST);

        test('when the function passes, it resolves with the value', done => {
            let callCount = 0;
            const pass5times = () => {
                if (callCount > 5) {
                    assert.fail('Should not be called more than 5 times');
                }

                return (++callCount === 5) ?
                    Promise.resolve('test') :
                    Promise.reject('fail');
            };

            Utilities.retryAsync(pass5times, 10, /*timeoutBetweenAttempts=*/0).then(
                result => {
                    assert.equal(result, 'test');
                    done();
                },
                e => {
                    assert.fail('This should have passed');
                });
        });

        test('when the function fails, it rejects', done => {
            let callCount = 0;
            Utilities.retryAsync(() => {
                if (++callCount > 10) {
                    assert.fail('Should not be called more than 10 times');
                }

                return Promise.reject('fail');
            }, 10, /*timeoutBetweenAttempts=*/0).then(
                () => assert.fail('This promise should fail'),
                e => {
                    assert.equal(e, 'fail');
                    done();
                });
        });
    });
});
