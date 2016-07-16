/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as mockery from 'mockery';
import * as assert from 'assert';

import * as testUtils from '../testUtils';
import {ITargetDiscoveryStrategy} from '../../src/chrome/chromeConnection';

const MODULE_UNDER_TEST = '../../src/chrome/chromeTargetDiscoveryStrategy';
suite('ChromeTargetDiscoveryStrategy', () => {
    function getChromeTargetDiscoveryStrategy(): ITargetDiscoveryStrategy {
        return require(MODULE_UNDER_TEST).getChromeTargetWebSocketURL;
    }

    setup(() => {
        testUtils.setupUnhandledRejectionListener();
        mockery.enable({ useCleanCache: true, warnOnReplace: false, warnOnUnregistered: false });
    });

    teardown(() => {
        testUtils.removeUnhandledRejectionListener();

        mockery.deregisterAll();
        mockery.disable();
    });

    const UTILS_PATH = '../utils';
    const TARGET_ADDRESS = '127.0.0.1';
    const TARGET_PORT = 9222;
    const TARGET_LIST_URL = `http://${TARGET_ADDRESS}:${TARGET_PORT}/json`;

    function registerTargetListContents(targetListJSON: string): void {
        testUtils.registerMockGetURL(UTILS_PATH, TARGET_LIST_URL, targetListJSON);
    }

    suite('getChromeTargetWebSocketURL()', () => {
        test('rejects promise if getting target list fails', () => {
            testUtils.registerMockGetURLFail(UTILS_PATH, TARGET_LIST_URL);

            return testUtils.assertPromiseRejected(
                getChromeTargetDiscoveryStrategy()(TARGET_ADDRESS, TARGET_PORT));
        });

        test('rejects promise if server responds with not JSON', () => {
            registerTargetListContents('this is not target list JSON');

            return testUtils.assertPromiseRejected(
                getChromeTargetDiscoveryStrategy()(TARGET_ADDRESS, TARGET_PORT));
        });

        test('rejects promise if server responds with JSON that is not an array', () => {
            registerTargetListContents('{ "prop1": "not an array" }');

            return testUtils.assertPromiseRejected(
                getChromeTargetDiscoveryStrategy()(TARGET_ADDRESS, TARGET_PORT));
        });

        test('respects the target filter', () => {
            const targets = [
                {
                    url: 'http://localhost/foo',
                    webSocketDebuggerUrl: 'ws://1'
                },
                {
                    url: 'http://localhost/bar',
                    webSocketDebuggerUrl: 'ws://2'
                }];
            registerTargetListContents(JSON.stringify(targets));

            return getChromeTargetDiscoveryStrategy()(TARGET_ADDRESS, TARGET_PORT, target => target.url === targets[1].url).then(wsUrl => {
                assert.deepEqual(wsUrl, targets[1].webSocketDebuggerUrl);
            });
        });

        test('rejects promise if no matching targets', () => {
            const targets = [
                {
                    url: 'http://localhost/foo',
                    webSocketDebuggerUrl: 'ws://1'
                },
                {
                    url: 'http://localhost/bar',
                    webSocketDebuggerUrl: 'ws://2'
                }];
            registerTargetListContents(JSON.stringify(targets));

            return testUtils.assertPromiseRejected(
                getChromeTargetDiscoveryStrategy()(TARGET_ADDRESS, TARGET_PORT, undefined, 'blah.com'));
        });

        test('when no targets have webSocketDebuggerUrl, fails', () => {
            const targets = [
                {
                    url: 'http://localhost/foo',
                },
                {
                    url: 'http://localhost/bar',
                }];
            registerTargetListContents(JSON.stringify(targets));

            return testUtils.assertPromiseRejected(
                getChromeTargetDiscoveryStrategy()(TARGET_ADDRESS, TARGET_PORT, undefined, 'localhost/*'));
        });

        test('ignores targets with no webSocketDebuggerUrl (as when chrome devtools is attached)', () => {
            const targets = [
                {
                    url: 'http://localhost/foo',
                    webSocketDebuggerUrl: undefined,
                },
                {
                    url: 'http://localhost/bar',
                    webSocketDebuggerUrl: 'ws://2'
                }];
            registerTargetListContents(JSON.stringify(targets));

            return getChromeTargetDiscoveryStrategy()(TARGET_ADDRESS, TARGET_PORT, target => target.url === targets[1].url).then(wsUrl => {
                assert.deepEqual(wsUrl, targets[1].webSocketDebuggerUrl);
            });
        });

        test('returns the first target when no target url pattern given', () => {
            const targets = [
                {
                    url: 'http://localhost/foo',
                    webSocketDebuggerUrl: 'ws://1'
                },
                {
                    url: 'http://localhost/bar',
                    webSocketDebuggerUrl: 'ws://2'
                }];
            registerTargetListContents(JSON.stringify(targets));

            return getChromeTargetDiscoveryStrategy()(TARGET_ADDRESS, TARGET_PORT).then(wsUrl => {
                assert.deepEqual(wsUrl, targets[0].webSocketDebuggerUrl);
            });
        });
    });
});