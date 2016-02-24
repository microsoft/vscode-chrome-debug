/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as mockery from 'mockery';
import * as assert from 'assert';
import * as _path from 'path';

import * as testUtils from '../testUtils';

/** Utilities without mocks - use for type only */
import * as _Utilities from '../../webkit/utilities';

let path: typeof _path;

const MODULE_UNDER_TEST = '../../webkit/utilities';
suite('Utilities', () => {
    function getUtilities(): typeof _Utilities {
        return require(MODULE_UNDER_TEST);
    }

    setup(() => {
        testUtils.setupUnhandledRejectionListener();

        mockery.enable({ useCleanCache: true, warnOnReplace: false });
        testUtils.win32Mocks();
        mockery.registerMock('fs', { statSync: () => { } });
        mockery.registerMock('http', {});
        path = require('path');

        mockery.registerAllowables([
            'url', MODULE_UNDER_TEST]);
    });

    teardown(() => {
        testUtils.removeUnhandledRejectionListener();

        mockery.deregisterAll();
        mockery.disable();
    });

    suite('getPlatform()/getBrowserPath()', () => {
        test('osx', () => {
            mockery.registerMock('os', { platform: () => 'darwin' });
            const Utilities = getUtilities();
            assert.equal(Utilities.getPlatform(), Utilities.Platform.OSX);
            assert.equal(
                Utilities.getBrowserPath(),
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
        });

        test('win', () => {
            // Overwrite the statSync mock to say the x86 path doesn't exist
            const statSync = (aPath: string) => {
                if (aPath.indexOf('(x86)') >= 0) throw new Error('Not found');
            };
            mockery.registerMock('fs', { statSync });

            const Utilities = getUtilities();
            assert.equal(Utilities.getPlatform(), Utilities.Platform.Windows);
            assert.equal(
                Utilities.getBrowserPath(),
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
        });

        test('winx86', () => {
            const Utilities = getUtilities();
            assert.equal(Utilities.getPlatform(), Utilities.Platform.Windows);
            assert.equal(
                Utilities.getBrowserPath(),
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe');
        });

        test('linux', () => {
            mockery.registerMock('os', { platform: () => 'linux' });
            const Utilities = getUtilities();
            assert.equal(Utilities.getPlatform(), Utilities.Platform.Linux);
            assert.equal(
                Utilities.getBrowserPath(),
                '/usr/bin/google-chrome');
        });

        test('freebsd (default to Linux for anything unknown)', () => {
            mockery.registerMock('os', { platform: () => 'freebsd' });
            const Utilities = getUtilities();
            assert.equal(Utilities.getPlatform(), Utilities.Platform.Linux);
            assert.equal(
                Utilities.getBrowserPath(),
                '/usr/bin/google-chrome');
        });
    });

    suite('existsSync()', () => {
        test('it returns false when statSync throws', () => {
            const statSync = (aPath: string) => {
                if (aPath.indexOf('notfound') >= 0) throw new Error('Not found');
            };
            mockery.registerMock('fs', { statSync });

            const Utilities = getUtilities();
            assert.equal(Utilities.existsSync('exists'), true);
            assert.equal(Utilities.existsSync('thisfilenotfound'), false);
        });
    });

    suite('reversedArr()', () => {
        test('it does not modify the input array', () => {
            let arr = [2, 4, 6];
            getUtilities().reversedArr(arr);
            assert.deepEqual(arr, [2, 4, 6]);

            arr = [1];
            getUtilities().reversedArr(arr);
            assert.deepEqual(arr, [1]);
        });

        test('it reverses the array', () => {
            assert.deepEqual(getUtilities().reversedArr([1, 3, 5, 7]), [7, 5, 3, 1]);
            assert.deepEqual(
                getUtilities().reversedArr([-1, 'hello', null, undefined, [1, 2]]),
                [[1, 2], undefined, null, 'hello', -1]);
        });
    });

    suite('promiseTimeout()', () => {
        test('when given a promise it fails if the promise never resolves', () => {
            return getUtilities().promiseTimeout(new Promise(() => { }), 5).then(
                () => assert.fail('This promise should fail'),
                e => { }
            );
        });

        test('when given a promise it succeeds if the promise resolves', () => {
            return getUtilities().promiseTimeout(Promise.resolve('test'), 5).then(
                result => {
                    assert.equal(result, 'test');
                },
                e => assert.fail('This promise should pass')
            );
        });

        test('when not given a promise it resolves', () => {
            return getUtilities().promiseTimeout(null, 5).then(
                null,
                () => assert.fail('This promise should pass')
            );
        });
    });

    suite('retryAsync()', () => {
        test('when the function passes, it resolves with the value', () => {
            return getUtilities().retryAsync(() => Promise.resolve('pass'), /*timeoutMs=*/5).then(
                result => {
                    assert.equal(result, 'pass');
                },
                e => {
                    assert.fail('This should have passed');
                });
        });

        test('when the function fails, it rejects', () => {
            return getUtilities().retryAsync(() => getUtilities().errP('fail'), /*timeoutMs=*/5)
                .then(
                    () => assert.fail('This promise should fail'),
                    e => assert.equal(e.message, 'fail'));
        });
    });

    suite('webkitUrlToClientPath()', () => {
        const TEST_CLIENT_PATH = 'c:\\site\\scripts\\a.js';
        const TEST_WEBKIT_LOCAL_URL = 'file:///' + TEST_CLIENT_PATH;
        const TEST_WEBKIT_HTTP_URL = 'http://site.com/page/scripts/a.js';
        const TEST_WEB_ROOT = 'c:\\site';

        test('an empty string is returned for a missing url', () => {
            assert.equal(getUtilities().webkitUrlToClientPath('', ''), '');
        });

        test('an empty string is returned when the webRoot is missing', () => {
            assert.equal(getUtilities().webkitUrlToClientPath(null, TEST_WEBKIT_HTTP_URL), '');
        });

        test('a url without a path returns an empty string', () => {
            assert.equal(getUtilities().webkitUrlToClientPath(TEST_WEB_ROOT, 'http://site.com'), '');
        });

        test('it searches the disk for a path that exists, built from the url', () => {
            const statSync = (aPath: string) => {
                if (aPath !== TEST_CLIENT_PATH) throw new Error('Not found');
            };
            mockery.registerMock('fs', { statSync });
            assert.equal(getUtilities().webkitUrlToClientPath(TEST_WEB_ROOT, TEST_WEBKIT_HTTP_URL), TEST_CLIENT_PATH);
        });

        test(`returns an empty string when it can't resolve a url`, () => {
            const statSync = (aPath: string) => {
                throw new Error('Not found');
            };
            mockery.registerMock('fs', { statSync });
            assert.equal(getUtilities().webkitUrlToClientPath(TEST_WEB_ROOT, TEST_WEBKIT_HTTP_URL), '');
        });

        test('file:/// urls are returned canonicalized', () => {
            assert.equal(getUtilities().webkitUrlToClientPath('', TEST_WEBKIT_LOCAL_URL), TEST_CLIENT_PATH);
        });

        test('uri encodings are fixed for file:/// paths', () => {
            const clientPath = 'c:\\project\\path with spaces\\script.js';
            assert.equal(getUtilities().webkitUrlToClientPath(TEST_WEB_ROOT, 'file:///' + encodeURI(clientPath)), clientPath);
        });

        test('uri encodings are fixed in URLs', () => {
            const pathSegment = 'path with spaces\\script.js';
            const url = 'http:\\' + encodeURIComponent(pathSegment);

            assert.equal(getUtilities().webkitUrlToClientPath(TEST_WEB_ROOT, url), path.join(TEST_WEB_ROOT, pathSegment));
        });
    });

    suite('canonicalizeUrl()', () => {
        function testCanUrl(inUrl: string, expectedUrl: string): void {
            const Utilities = getUtilities();
            assert.equal(Utilities.canonicalizeUrl(inUrl), expectedUrl);
        }

        test('enforces path.sep slash', () => {
            testCanUrl('c:\\thing\\file.js', 'c:\\thing\\file.js');
            testCanUrl('c:/thing/file.js', 'c:\\thing\\file.js');
        });

        test('removes file:///', () => {
            testCanUrl('file:///c:/file.js', 'c:\\file.js');
        });

        test('ensures local path starts with / on OSX', () => {
            mockery.registerMock('os', { platform: () => 'darwin' });
            testCanUrl('file:///Users/scripts/app.js', '/Users/scripts/app.js');
        });

        test('force lowercase drive letter on Win to match VS Code', () => {
            // note default 'os' mock is win32
            testCanUrl('file:///D:/FILE.js', 'd:\\FILE.js');
        });

        test('http:// url - no change', () => {
            const url = 'http://site.com/My/Cool/Site/script.js?stuff';
            testCanUrl(url, url);
        });

        test('strips trailing slash', () => {
            testCanUrl('http://site.com/', 'http://site.com');
        });
    });

    suite('fixDriveLetterAndSlashes', () => {
        test('works for c:/... cases', () => {
            assert.equal(getUtilities().fixDriveLetterAndSlashes('C:/path/stuff'), 'c:\\path\\stuff');
            assert.equal(getUtilities().fixDriveLetterAndSlashes('c:/path\\stuff'), 'c:\\path\\stuff');
            assert.equal(getUtilities().fixDriveLetterAndSlashes('C:\\path'), 'c:\\path');
            assert.equal(getUtilities().fixDriveLetterAndSlashes('C:\\'), 'c:\\');
        });

        test('works for file:/// cases', () => {
            assert.equal(getUtilities().fixDriveLetterAndSlashes('file:///C:/path/stuff'), 'file:///c:\\path\\stuff');
            assert.equal(getUtilities().fixDriveLetterAndSlashes('file:///c:/path\\stuff'), 'file:///c:\\path\\stuff');
            assert.equal(getUtilities().fixDriveLetterAndSlashes('file:///C:\\path'), 'file:///c:\\path');
            assert.equal(getUtilities().fixDriveLetterAndSlashes('file:///C:\\'), 'file:///c:\\');
        });
    });

    suite('remoteObjectToValue()', () => {
        const TEST_OBJ_ID = 'objectId';

        function testRemoteObjectToValue(obj: any, value: string, variableHandleRef?: string, stringify?: boolean): void {
            const Utilities = getUtilities();

            assert.deepEqual(Utilities.remoteObjectToValue(obj, stringify), { value, variableHandleRef });
        }

        test('bool', () => {
            testRemoteObjectToValue({ type: 'boolean', value: true }, 'true');
        });

        test('string', () => {
            let value = 'test string';
            testRemoteObjectToValue({ type: 'string', value }, `"${value}"`);
            testRemoteObjectToValue({ type: 'string', value }, `${value}`, undefined, /*stringify=*/false);

            value = 'test string\r\nwith\nnewlines\n\n';
            const expValue = 'test string\\r\\nwith\\nnewlines\\n\\n';
            testRemoteObjectToValue({ type: 'string', value }, `"${expValue}"`);
        });

        test('number', () => {
            testRemoteObjectToValue({ type: 'number', value: 1, description: '1' }, '1');
        });

        test('array', () => {
            const description = 'Array[2]';
            testRemoteObjectToValue({ type: 'object', description, objectId: TEST_OBJ_ID }, description, TEST_OBJ_ID);
        });

        test('regexp', () => {
            const description = '/^asdf/g';
            testRemoteObjectToValue({ type: 'object', description, objectId: TEST_OBJ_ID }, description, TEST_OBJ_ID);
        });

        test('symbol', () => {
            const description = 'Symbol(s)';
            testRemoteObjectToValue({ type: 'symbol', description, objectId: TEST_OBJ_ID }, description);
        });

        test('function', () => {
            // ES6 arrow fn
            testRemoteObjectToValue({ type: 'function', description: '() => {\n  var x = 1;\n  var y = 1;\n}', objectId: TEST_OBJ_ID }, '() => { … }');

            // named fn
            testRemoteObjectToValue({ type: 'function', description: 'function asdf() {\n  var z = 5;\n}' }, 'function asdf() { … }');

            // anonymous fn
            testRemoteObjectToValue({ type: 'function', description: 'function () {\n  var z = 5;\n}' }, 'function () { … }');
        });

        test('undefined', () => {
            testRemoteObjectToValue({ type: 'undefined' }, 'undefined');
        });

        test('null', () => {
            testRemoteObjectToValue({ type: 'object', subtype: 'null' }, 'null');
        });
    });

    suite('getWebRoot()', () => {
        test('takes absolute webRoot as is', () => {
            assert.equal(getUtilities().getWebRoot({ webRoot: 'c:\\project\\webRoot', cwd: 'c:\\project\\cwd' }), 'c:\\project\\webRoot');
        });

        test('resolves relative webroot against cwd', () => {
            assert.equal(getUtilities().getWebRoot({ webRoot: '..\\webRoot', cwd: 'c:\\project\\cwd' }), 'c:\\project\\webRoot');
        });

        test('uses cwd when webRoot is missing', () => {
            assert.equal(getUtilities().getWebRoot({ webRoot: '', cwd: 'c:\\project\\cwd' }), 'c:\\project\\cwd');
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
                        (eventName, eventCallback) => {
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
            return getUtilities().getURL(URL).then(response => {
                assert.equal(response, RESPONSE);
            });
        });

        test('rejects the promise on an error', () => {
            registerMockHTTP(undefined, 'fail');
            return getUtilities().getURL(URL).then(
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
            assert(getUtilities().isURL(url));
        }

        function assertNotURL(url: string): void {
            assert(!getUtilities().isURL(url));
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
            assert.equal(getUtilities().lstrip('test', 'te'), 'st');
            assert.equal(getUtilities().lstrip('asdf', ''), 'asdf');
            assert.equal(getUtilities().lstrip('asdf', null), 'asdf');
            assert.equal(getUtilities().lstrip('asdf', 'asdf'), '');
            assert.equal(getUtilities().lstrip('asdf', '123'), 'asdf');
            assert.equal(getUtilities().lstrip('asdf', 'sdf'), 'asdf');
        });
    });

    suite('pathToFileURL', () => {
        test('converts windows-style paths', () => {
            assert.equal(getUtilities().pathToFileURL('c:/code/app.js'), 'file:///c:/code/app.js');
        });

        test('converts unix-style paths', () => {
            assert.equal(getUtilities().pathToFileURL('/code/app.js'), 'file:///code/app.js');
        });
    });
});
