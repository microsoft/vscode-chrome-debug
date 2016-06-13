/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as mockery from 'mockery';
import * as assert from 'assert';
import * as _path from 'path';

import * as Chrome from '../../src/chrome/chromeDebugProtocol';
import * as testUtils from '../testUtils';

/** ChromeUtils without mocks - use for type only */
import * as _ChromeUtils from '../../src/chrome/chromeUtils';

let path: typeof _path;

const MODULE_UNDER_TEST = '../../src/chrome/chromeUtils';
suite('ChromeUtils', () => {
    function getChromeUtils(): typeof _ChromeUtils {
        return require(MODULE_UNDER_TEST);
    }

    setup(() => {
        testUtils.setupUnhandledRejectionListener();
        mockery.enable({ useCleanCache: true, warnOnReplace: false, warnOnUnregistered: false });
        testUtils.registerWin32Mocks();

        mockery.registerMock('fs', { statSync: () => { } });
        testUtils.registerEmptyMocks('http');

        // Get path with win32 mocks
        path = require('path');
    });

    teardown(() => {
        testUtils.removeUnhandledRejectionListener();

        mockery.deregisterAll();
        mockery.disable();
    });

    suite('targetUrlToClientPath()', () => {
        const TEST_CLIENT_PATH = 'c:\\site\\scripts\\a.js';
        const TEST_TARGET_LOCAL_URL = 'file:///' + TEST_CLIENT_PATH;
        const TEST_TARGET_HTTP_URL = 'http://site.com/page/scripts/a.js';
        const TEST_WEB_ROOT = 'c:\\site';

        test('an empty string is returned for a missing url', () => {
            assert.equal(getChromeUtils().targetUrlToClientPath('', ''), '');
        });

        test('an empty string is returned when the webRoot is missing', () => {
            assert.equal(getChromeUtils().targetUrlToClientPath(null, TEST_TARGET_HTTP_URL), '');
        });

        test('a url without a path returns an empty string', () => {
            assert.equal(getChromeUtils().targetUrlToClientPath(TEST_WEB_ROOT, 'http://site.com'), '');
        });

        test('it searches the disk for a path that exists, built from the url', () => {
            const statSync = (aPath: string) => {
                if (aPath !== TEST_CLIENT_PATH) throw new Error('Not found');
            };
            mockery.registerMock('fs', { statSync });
            assert.equal(getChromeUtils().targetUrlToClientPath(TEST_WEB_ROOT, TEST_TARGET_HTTP_URL), TEST_CLIENT_PATH);
        });

        test(`returns an empty string when it can't resolve a url`, () => {
            const statSync = (aPath: string) => {
                throw new Error('Not found');
            };
            mockery.registerMock('fs', { statSync });
            assert.equal(getChromeUtils().targetUrlToClientPath(TEST_WEB_ROOT, TEST_TARGET_HTTP_URL), '');
        });

        test('file:/// urls are returned canonicalized', () => {
            assert.equal(getChromeUtils().targetUrlToClientPath('', TEST_TARGET_LOCAL_URL), TEST_CLIENT_PATH);
        });

        test('uri encodings are fixed for file:/// paths', () => {
            const clientPath = 'c:\\project\\path with spaces\\script.js';
            assert.equal(getChromeUtils().targetUrlToClientPath(TEST_WEB_ROOT, 'file:///' + encodeURI(clientPath)), clientPath);
        });

        test('uri encodings are fixed in URLs', () => {
            const pathSegment = 'path with spaces\\script.js';
            const url = 'http:\\' + encodeURIComponent(pathSegment);

            assert.equal(getChromeUtils().targetUrlToClientPath(TEST_WEB_ROOT, url), path.join(TEST_WEB_ROOT, pathSegment));
        });
    });

    suite('remoteObjectToValue()', () => {
        const TEST_OBJ_ID = 'objectId';

        function testRemoteObjectToValue(obj: any, value: string, variableHandleRef?: string, stringify?: boolean): void {
            const Utilities = getChromeUtils();

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

    suite('getMatchingTargets()', () => {
        const chromeUtils = getChromeUtils();

        function makeTargets(...urls): Chrome.ITarget[] {
            // Only the url prop is used
            return <any>urls.map(url => ({ url }));
        }

        test('tries exact match before fuzzy match', () => {
            const targets = makeTargets('http://localhost/site/page', 'http://localhost/site');
            assert.deepEqual(
                chromeUtils.getMatchingTargets(targets, 'http://localhost/site'),
                [targets[1]]);
        });

        test('returns fuzzy matches if exact match fails', () => {
            const targets = makeTargets('http://localhost:8080/site/app/page1?something=3', 'http://cnn.com', 'http://localhost/site');
            assert.deepEqual(
                chromeUtils.getMatchingTargets(targets, 'http://localhost'),
                [targets[0], targets[2]]);
        });

        test('ignores the url protocol', () => {
            const targets = makeTargets('https://outlook.com', 'http://localhost');
            assert.deepEqual(
                chromeUtils.getMatchingTargets(targets, 'https://localhost'),
                [targets[1]]);
        });

        test('"exact match" is case-insensitive', () => {
            const targets = makeTargets('http://localhost/site', 'http://localhost');
            assert.deepEqual(
                chromeUtils.getMatchingTargets(targets, 'http://Localhost'),
                [targets[1]]);
        });

        test('ignores query params', () => {
            const targets = makeTargets('http://testsite.com?q=5');
            assert.deepEqual(
                chromeUtils.getMatchingTargets(targets, 'testsite.com?q=1'),
                targets);
        });
    });
});
