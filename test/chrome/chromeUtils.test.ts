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

            value = 'NaN';
            testRemoteObjectToValue({ type: 'string', value }, `"${value}"`);

            value = '-Infinity';
            testRemoteObjectToValue({ type: 'string', value }, `"${value}"`);

            value = 'test string\r\nwith\nnewlines\n\n';
            const expValue = 'test string\\r\\nwith\\nnewlines\\n\\n';
            testRemoteObjectToValue({ type: 'string', value }, `"${expValue}"`);
        });

        test('number', () => {
            testRemoteObjectToValue({ type: 'number', value: 1 }, '1');
            testRemoteObjectToValue({ type: 'number', value: 'NaN' }, 'NaN');
            testRemoteObjectToValue({ type: 'number', value: 'Infinity' }, 'Infinity');
            testRemoteObjectToValue({ type: 'number', value: '-Infinity' }, '-Infinity');
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

        test('returns exact match', () => {
            const targets = makeTargets('http://localhost/site/page', 'http://localhost/site');
            assert.deepEqual(
                chromeUtils.getMatchingTargets(targets, 'http://localhost/site'),
                [targets[1]]);
        });

        test('ignores the url protocol', () => {
            const targets = makeTargets('https://outlook.com', 'http://localhost');
            assert.deepEqual(
                chromeUtils.getMatchingTargets(targets, 'https://localhost'),
                [targets[1]]);
        });

        test('really ignores the url protocol', () => {
            const targets = makeTargets('https://outlook.com', 'http://localhost');
            assert.deepEqual(
                chromeUtils.getMatchingTargets(targets, 'localhost'),
                [targets[1]]);
        });

        test('is case-insensitive', () => {
            const targets = makeTargets('http://localhost/site', 'http://localhost');
            assert.deepEqual(
                chromeUtils.getMatchingTargets(targets, 'http://LOCALHOST'),
                [targets[1]]);
        });

        test('does not return substring fuzzy match as in pre 0.1.9', () => {
            const targets = makeTargets('http://localhost/site/page');
            assert.deepEqual(
                chromeUtils.getMatchingTargets(targets, 'http://localhost/site'),
                []);
        });

        test('respects one wildcard', () => {
            const targets = makeTargets('http://localhost/site/app', 'http://localhost/site/', 'http://localhost/');
            assert.deepEqual(
                chromeUtils.getMatchingTargets(targets, 'localhost/site/*'),
                [targets[0], targets[1]]);
        });

        test('respects wildcards with query params', () => {
            const targets = makeTargets('http://localhost:3000/site/?blah=1', 'http://localhost:3000/site/?blah=2', 'http://localhost:3000/site/');
            assert.deepEqual(
                chromeUtils.getMatchingTargets(targets, 'localhost:3000/site/?*'),
                [targets[0], targets[1]]);
        });

        // Because the match is regex-based
        test('works with other special chars', () => {
            const targets = makeTargets('http://localhost/[bar]/?(words)', 'http://localhost/bar/?words', 'http://localhost/[bar]/?(somethingelse)');
            assert.deepEqual(
                chromeUtils.getMatchingTargets(targets, 'http://localhost/[bar]/?(*)'),
                [targets[0], targets[2]]);
        });

        test('matches an ending slash', () => {
            const targets = makeTargets('http://localhost/', 'http://localhost');
            assert.deepEqual(
                chromeUtils.getMatchingTargets(targets, 'http://localhost'),
                targets);
        });
    });

    suite('compareVariableNames', () => {
        const chromeUtils = getChromeUtils();

        test('numbers sorted numerically', () => {
            assert(chromeUtils.compareVariableNames('6', '1') > 0);
            assert(chromeUtils.compareVariableNames('2', '10') < 0);
        });

        test('string names before number names', () => {
            assert(chromeUtils.compareVariableNames('a', '1') < 0);
            assert(chromeUtils.compareVariableNames('16', 'b') > 0);
        });

        test('string names ordered correctly', () => {
            assert.equal(chromeUtils.compareVariableNames('a', 'b'), 'a'.localeCompare('b'));
            assert.equal(chromeUtils.compareVariableNames('xyz123', '890kjh'), 'xyz123'.localeCompare('890kjh'));
        });
    });
});
