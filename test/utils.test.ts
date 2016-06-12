/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as mockery from 'mockery';
import * as assert from 'assert';
import * as _path from 'path';

import * as testUtils from './testUtils';

/** Utils without mocks - use for type only */
import * as _Utils from '../src/utils';

let path: typeof _path;

const MODULE_UNDER_TEST = '../src/utils';
suite('Utils', () => {
    function getUtils(): typeof _Utils {
        return require(MODULE_UNDER_TEST);
    }

    setup(() => {
        testUtils.setupUnhandledRejectionListener();

        mockery.enable({ useCleanCache: true, warnOnReplace: false });
        testUtils.registerWin32Mocks();
        mockery.registerMock('fs', { statSync: () => { } });
        mockery.registerMock('http', {});
        path = require('path');

        mockery.registerAllowables([
            MODULE_UNDER_TEST, 'url', './logger']);
    });

    teardown(() => {
        testUtils.removeUnhandledRejectionListener();

        mockery.deregisterAll();
        mockery.disable();
    });

    suite('getPlatform()/getBrowserPath()', () => {
        test('osx', () => {
            mockery.registerMock('os', { platform: () => 'darwin' });
            const Utils = getUtils();
            assert.equal(Utils.getPlatform(), Utils.Platform.OSX);
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

            const Utils = getUtils();
            assert.equal(Utils.getPlatform(), Utils.Platform.Windows);
            assert.equal(
                Utils.getBrowserPath(),
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
        });

        test('winx86', () => {
            const Utils = getUtils();
            assert.equal(Utils.getPlatform(), Utils.Platform.Windows);
            assert.equal(
                Utils.getBrowserPath(),
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe');
        });

        test('linux', () => {
            mockery.registerMock('os', { platform: () => 'linux' });
            const Utils = getUtils();
            assert.equal(Utils.getPlatform(), Utils.Platform.Linux);
            assert.equal(
                Utils.getBrowserPath(),
                '/usr/bin/google-chrome');
        });

        test('freebsd (default to Linux for anything unknown)', () => {
            mockery.registerMock('os', { platform: () => 'freebsd' });
            const Utils = getUtils();
            assert.equal(Utils.getPlatform(), Utils.Platform.Linux);
            assert.equal(
                Utils.getBrowserPath(),
                '/usr/bin/google-chrome');
        });
    });

    suite('existsSync()', () => {
        test('it returns false when statSync throws', () => {
            const statSync = (aPath: string) => {
                if (aPath.indexOf('notfound') >= 0) throw new Error('Not found');
            };
            mockery.registerMock('fs', { statSync });

            const Utils = getUtils();
            assert.equal(Utils.existsSync('exists'), true);
            assert.equal(Utils.existsSync('thisfilenotfound'), false);
        });
    });

    suite('reversedArr()', () => {
        test('it does not modify the input array', () => {
            let arr = [2, 4, 6];
            getUtils().reversedArr(arr);
            assert.deepEqual(arr, [2, 4, 6]);

            arr = [1];
            getUtils().reversedArr(arr);
            assert.deepEqual(arr, [1]);
        });

        test('it reverses the array', () => {
            assert.deepEqual(getUtils().reversedArr([1, 3, 5, 7]), [7, 5, 3, 1]);
            assert.deepEqual(
                getUtils().reversedArr([-1, 'hello', null, undefined, [1, 2]]),
                [[1, 2], undefined, null, 'hello', -1]);
        });
    });

    suite('promiseTimeout()', () => {
        test('when given a promise it fails if the promise never resolves', () => {
            return getUtils().promiseTimeout(new Promise(() => { }), 5).then(
                () => assert.fail('This promise should fail'),
                e => { }
            );
        });

        test('when given a promise it succeeds if the promise resolves', () => {
            return getUtils().promiseTimeout(Promise.resolve('test'), 5).then(
                result => {
                    assert.equal(result, 'test');
                },
                e => assert.fail('This promise should pass')
            );
        });

        test('when not given a promise it resolves', () => {
            return getUtils().promiseTimeout(null, 5).then(
                null,
                () => assert.fail('This promise should pass')
            );
        });
    });

    suite('retryAsync()', () => {
        test('when the function passes, it resolves with the value', () => {
            return getUtils().retryAsync(() => Promise.resolve('pass'), /*timeoutMs=*/5).then(
                result => {
                    assert.equal(result, 'pass');
                },
                e => {
                    assert.fail('This should have passed');
                });
        });

        test('when the function fails, it rejects', () => {
            return getUtils().retryAsync(() => getUtils().errP('fail'), /*timeoutMs=*/5)
                .then(
                    () => assert.fail('This promise should fail'),
                    e => assert.equal(e.message, 'fail'));
        });
    });

    suite('canonicalizeUrl()', () => {
        function testCanUrl(inUrl: string, expectedUrl: string): void {
            const Utils = getUtils();
            assert.equal(Utils.canonicalizeUrl(inUrl), expectedUrl);
        }

        test('enforces path.sep slash', () => {
            testCanUrl('c:\\thing\\file.js', 'c:\\thing\\file.js');
            testCanUrl('c:/thing/file.js', 'c:\\thing\\file.js');
        });

        test('removes file:///', () => {
            testCanUrl('file:///c:/file.js', 'c:\\file.js');
        });

        test('unescape when doing url -> path', () => {
            testCanUrl('file:///c:/path%20with%20spaces', 'c:\\path with spaces');
        });

        test('ensures local path starts with / on OSX', () => {
            mockery.registerMock('os', { platform: () => 'darwin' });
            testCanUrl('file:///Users/scripts/app.js', '/Users/scripts/app.js');
        });

        test('force lowercase drive letter on Win to match VS Code', () => {
            // note default 'os' mock is win32
            testCanUrl('file:///D:/FILE.js', 'd:\\FILE.js');
        });

        test('removes query params from url', () => {
            const cleanUrl = 'http://site.com/My/Cool/Site/script.js';
            const url = cleanUrl + '?stuff';
            testCanUrl(url, cleanUrl);
        });

        test('strips trailing slash', () => {
            testCanUrl('http://site.com/', 'http://site.com');
        });
    });

    suite('fixDriveLetterAndSlashes', () => {
        test('works for c:/... cases', () => {
            assert.equal(getUtils().fixDriveLetterAndSlashes('C:/path/stuff'), 'c:\\path\\stuff');
            assert.equal(getUtils().fixDriveLetterAndSlashes('c:/path\\stuff'), 'c:\\path\\stuff');
            assert.equal(getUtils().fixDriveLetterAndSlashes('C:\\path'), 'c:\\path');
            assert.equal(getUtils().fixDriveLetterAndSlashes('C:\\'), 'c:\\');
        });

        test('works for file:/// cases', () => {
            assert.equal(getUtils().fixDriveLetterAndSlashes('file:///C:/path/stuff'), 'file:///c:\\path\\stuff');
            assert.equal(getUtils().fixDriveLetterAndSlashes('file:///c:/path\\stuff'), 'file:///c:\\path\\stuff');
            assert.equal(getUtils().fixDriveLetterAndSlashes('file:///C:\\path'), 'file:///c:\\path');
            assert.equal(getUtils().fixDriveLetterAndSlashes('file:///C:\\'), 'file:///c:\\');
        });
    });

    suite('getUrl', () => {
        const URL = 'http://testsite.com/testfile';
        const RESPONSE = 'response';

        function registerMockHTTP(dataResponses: string[], error?: string): void {
            mockery.registerMock('http', { get: (url, callback) => {
                assert.equal(url, URL);

                if (error) {
                    return { on:
                        (eventName: string, eventCallback: Function) => {
                            if (eventName === 'error') {
                                eventCallback(error);
                            }
                        }};
                } else {
                    callback({
                        statusCode: 200,
                        on: (eventName, eventCallback) => {
                            if (eventName === 'data') {
                                dataResponses.forEach(eventCallback);
                            } else if (eventName === 'end') {
                                setTimeout(eventCallback, 0);
                            }
                        }});

                    return { on: () => { }};
                }
            }});
        }

        test('combines chunks', () => {
            // Create a mock http.get that provides data in two chunks
            registerMockHTTP(['res', 'ponse']);
            return getUtils().getURL(URL).then(response => {
                assert.equal(response, RESPONSE);
            });
        });

        test('rejects the promise on an error', () => {
            registerMockHTTP(undefined, 'fail');
            return getUtils().getURL(URL).then(
                response => {
                    assert.fail('Should not be resolved');
                },
                e => {
                    assert.equal(e, 'fail');
                });
        });
    });

    suite('isURL', () => {
        function assertIsURL(url: string): void {
            assert(getUtils().isURL(url));
        }

        function assertNotURL(url: string): void {
            assert(!getUtils().isURL(url));
        }

        test('returns true for URLs', () => {
            assertIsURL('http://localhost');
            assertIsURL('http://mysite.com');
            assertIsURL('file:///c:/project/code.js');
            assertIsURL('webpack:///webpack/webpackthing');
            assertIsURL('https://a.b.c:123/asdf?fsda');
        });

        test('returns false for not-URLs', () => {
            assertNotURL('a');
            assertNotURL('/project/code.js');
            assertNotURL('c:/project/code.js');
            assertNotURL('abc123!@#');
            assertNotURL('');
            assertNotURL(null);
        });
    });

    suite('lstrip', () => {
        test('does what it says', () => {
            assert.equal(getUtils().lstrip('test', 'te'), 'st');
            assert.equal(getUtils().lstrip('asdf', ''), 'asdf');
            assert.equal(getUtils().lstrip('asdf', null), 'asdf');
            assert.equal(getUtils().lstrip('asdf', 'asdf'), '');
            assert.equal(getUtils().lstrip('asdf', '123'), 'asdf');
            assert.equal(getUtils().lstrip('asdf', 'sdf'), 'asdf');
        });
    });

    suite('pathToFileURL', () => {
        test('converts windows-style paths', () => {
            assert.equal(getUtils().pathToFileURL('c:\\code\\app.js'), 'file:///c:/code/app.js');
        });

        test('converts unix-style paths', () => {
            assert.equal(getUtils().pathToFileURL('/code/app.js'), 'file:///code/app.js');
        });

        test('encodes as URI and forces forwards slash', () => {
            assert.equal(getUtils().pathToFileURL('c:\\path with spaces\\blah.js'), 'file:///c:/path%20with%20spaces/blah.js');
        });
    });
});
