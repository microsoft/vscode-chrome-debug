/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from 'assert';
import { EventEmitter } from 'events';
import * as mockery from 'mockery';
import { IMock, It, Mock, MockBehavior, Times } from 'typemoq';
import { chromeConnection, ISourceMapPathOverrides, telemetry } from 'vscode-chrome-debug-core';
import { DebugProtocol } from 'vscode-debugprotocol';
import { ChromeDebugAdapter as _ChromeDebugAdapter } from '../src/chromeDebugAdapter';
import { getMockChromeConnectionApi, IMockChromeConnectionAPI } from './debugProtocolMocks';
import * as testUtils from './testUtils';

class MockChromeDebugSession {
    public sendEvent(event: DebugProtocol.Event): void {
    }

    public sendRequest(command: string, args: any, timeout: number, cb: (response: DebugProtocol.Response) => void): void {
    }
}

const MODULE_UNDER_TEST = '../src/chromeDebugAdapter';
suite('ChromeDebugAdapter', () => {
    let mockChromeConnection: IMock<chromeConnection.ChromeConnection>;
    let mockEventEmitter: EventEmitter;
    let mockChrome: IMockChromeConnectionAPI;

    let mockChromeDebugSession: IMock<MockChromeDebugSession>;
    let chromeDebugAdapter: _ChromeDebugAdapter;

    setup(() => {
        testUtils.setupUnhandledRejectionListener();
        testUtils.registerLocMocks();
        mockery.enable({ useCleanCache: true, warnOnReplace: false, warnOnUnregistered: false });

        // Create a ChromeConnection mock with .on and .attach. Tests can fire events via mockEventEmitter
        mockChromeConnection = Mock.ofType(chromeConnection.ChromeConnection, MockBehavior.Strict);
        mockChrome = getMockChromeConnectionApi();
        mockEventEmitter = mockChrome.mockEventEmitter;
        mockChromeDebugSession = Mock.ofType(MockChromeDebugSession, MockBehavior.Strict);
        mockChromeDebugSession
            .setup(x => x.sendEvent(It.isAny()))
            .verifiable(Times.atLeast(0));
        mockChromeDebugSession
            .setup(x => x.sendRequest(It.isAnyString(), It.isAny(), It.isAnyNumber(), It.isAny()))
            .verifiable(Times.atLeast(0));

        mockChromeConnection
            .setup(x => x.api)
            .returns(() => mockChrome.apiObjects)
            .verifiable(Times.atLeast(0));
        mockChromeConnection
            .setup(x => x.attach(It.isValue(undefined), It.isAnyNumber(), It.isValue(undefined)))
            .returns(() => Promise.resolve())
            .verifiable(Times.atLeast(0));
        mockChromeConnection
            .setup(x => x.isAttached)
            .returns(() => false)
            .verifiable(Times.atLeast(0));
        mockChromeConnection
            .setup(x => x.run())
            .returns(() => Promise.resolve())
            .verifiable(Times.atLeast(0));
        mockChromeConnection
            .setup(x => x.onClose(It.isAny()))
            .verifiable(Times.atLeast(0));
        mockChromeConnection
            .setup(x => x.events)
            .returns(x => null)
            .verifiable(Times.atLeast(0));

        // Instantiate the ChromeDebugAdapter, injecting the mock ChromeConnection
        const cDAClass: typeof _ChromeDebugAdapter = require(MODULE_UNDER_TEST).ChromeDebugAdapter;
        chromeDebugAdapter = new cDAClass({ chromeConnection: function() { return mockChromeConnection.object; } } as any, mockChromeDebugSession.object as any);
    });

    teardown(() => {
        testUtils.removeUnhandledRejectionListener();
        mockery.deregisterAll();
        mockery.disable();
        mockChromeConnection.verifyAll();
    });

    suite('launch()', () => {
        let originalFork: any;
        let originalSpawn: any;
        let originalStatSync: any;

        setup(() => {
            mockChromeConnection
                .setup(x => x.attach(It.isValue(undefined), It.isAnyNumber(), It.isAnyString(), It.isValue(undefined), It.isValue(undefined)))
                .returns(() => Promise.resolve())
                .verifiable();

            mockChrome.Runtime
                .setup(x => x.evaluate(It.isAny()))
                .returns(() => Promise.resolve<any>({ result: { type: 'string', value: '123' }}));
        });

        teardown(() => {
            // Hacky mock cleanup
            require('child_process').fork = originalFork;
            require('fs').statSync = originalStatSync;
        });

        test('launches with minimal correct args', () => {
            let spawnCalled = false;
            function fork(chromeSpawnHelperPath: string, [chromePath, ...args]: string[]): any {
                // Just assert that the chrome path is some string with 'chrome' in the path, and there are >0 args
                assert(chromeSpawnHelperPath.indexOf('chromeSpawnHelper.js') >= 0);
                return spawn(chromePath, args);
            }

            function spawn(chromePath: string, args: string[]): any {
                assert(chromePath.toLowerCase().indexOf('chrome') >= 0);
                assert(args.indexOf('--remote-debugging-port=9222') >= 0);
                assert(args.indexOf('about:blank') >= 0); // Now we use the landing page for all scenarios
                assert(args.indexOf('abc') >= 0);
                assert(args.indexOf('def') >= 0);
                spawnCalled = true;

                const stdio = { on: () => { } };
                return { on: () => { }, unref: () => { }, stdout: stdio, stderr: stdio };
            }

            // Mock fork/spawn for chrome process, and 'fs' for finding chrome.exe.
            // These are mocked as empty above - note that it's too late for mockery here.
            originalFork = require('child_process').fork;
            originalSpawn = require('child_process').spawn;
            require('child_process').fork = fork;
            require('child_process').spawn = spawn;
            originalStatSync = require('fs').statSync;
            require('fs').statSync = () => true;

            return chromeDebugAdapter.launch({ file: 'c:\\path with space\\index.html', runtimeArgs: ['abc', 'def'] },
                                             new telemetry.TelemetryPropertyCollector())
                .then(() => assert(spawnCalled));
        });

        test('launches unelevated with client', async () => {
            let telemetryPropertyCollector = new telemetry.TelemetryPropertyCollector();
            chromeDebugAdapter.initialize({
                adapterID: 'test debug adapter',
                pathFormat: 'path',
                supportsLaunchUnelevatedProcessRequest: true
            });

            const originalGetPlatform = require('os').platform;
            require('os').platform = () => { return 'win32'; };

            const originalGetBrowser = require('../src/utils').getBrowserPath;
            require('../src/utils').getBrowserPath = () => { return 'c:\\someplace\\chrome.exe'; };

            const expectedProcessId = 325;
            let collectedLaunchParams: any;
            mockChromeDebugSession
                .setup(x => x.sendRequest('launchUnelevated',
                    It.is((param: any) => {
                        collectedLaunchParams = param;
                        return true;
                    }),
                    10000,
                    It.is(
                        (callback: (response: DebugProtocol.Response) => void) => {
                            callback({
                                seq: null,
                                type: 'command',
                                request_seq: 100,
                                command: 'launchUnelevated',
                                success: true,
                                body: {
                                    processId: expectedProcessId
                                }
                            });
                            return true;
                        })))
                    .verifiable(Times.atLeast(1));

            await chromeDebugAdapter.launch({
                file: 'c:\\path with space\\index.html',
                runtimeArgs: ['abc', 'def'],
                shouldLaunchChromeUnelevated: true
            }, telemetryPropertyCollector);

            assert.equal(expectedProcessId, (<any>chromeDebugAdapter)._chromePID, 'Debug Adapter should receive the Chrome process id');
            assert(collectedLaunchParams.process != null);
            assert(collectedLaunchParams.process.match(/chrome/i));
            assert(collectedLaunchParams.args != null);

            assert(collectedLaunchParams.args.filter(arg => arg === '--no-default-browser-check').length !== 0,
                'Should have seen the --no-default-browser-check parameter');
            assert(collectedLaunchParams.args.filter(arg => arg === '--no-first-run').length !== 0,
                'Should have seen the --no-first-run parameter');
            assert(collectedLaunchParams.args.filter(arg => arg === 'abc').length !== 0,
                'Should have seen the abc parameter');
            assert(collectedLaunchParams.args.filter(arg => arg === 'def').length !== 0,
                'Should have seen the def parameter');
            assert(collectedLaunchParams.args.filter(arg => arg === 'about:blank').length !== 0,
                'Should have seen the about:blank parameter');
            assert(collectedLaunchParams.args.filter(arg => arg.match(/remote-debugging-port/)).length !== 0,
                'Should have seen a parameter like remote-debugging-port');
            assert(collectedLaunchParams.args.filter(arg => arg.match(/user-data-dir/)).length !== 0,
                'Should have seen a parameter like user-data-dir');

            const telemetryProperties = telemetryPropertyCollector.getProperties();
            assert.equal(telemetryProperties.shouldLaunchChromeUnelevated, 'true', "Should send telemetry that Chrome is requested to be launched unelevated.'");
            assert.equal(telemetryProperties.doesHostSupportLaunchUnelevated, 'true', "Should send telemetry that host supports launcheing Chrome unelevated.'");

            require('os').platform = originalGetPlatform;
            require('../src/utils').getBrowserPath = originalGetBrowser;
        });
    });

    suite('resolveWebRootPattern', () => {
        const WEBROOT = testUtils.pathResolve('/project/webroot');
        const resolveWebRootPattern = require(MODULE_UNDER_TEST).resolveWebRootPattern;

        test('does nothing when no ${webRoot} present', () => {
            const overrides: ISourceMapPathOverrides = { '/src': '/project' };
            assert.deepEqual(
                resolveWebRootPattern(WEBROOT, overrides),
                overrides);
        });

        test('resolves the webRoot pattern', () => {
            assert.deepEqual(
                resolveWebRootPattern(WEBROOT, <ISourceMapPathOverrides>{ '/src': '${webRoot}/app/src'}),
                { '/src': WEBROOT + '/app/src' });
            assert.deepEqual(
                resolveWebRootPattern(WEBROOT, <ISourceMapPathOverrides>{ '${webRoot}/src': '${webRoot}/app/src'}),
                { [WEBROOT + '/src']:  WEBROOT + '/app/src'});
        });

        test(`ignores the webRoot pattern when it's not at the beginning of the string`, () => {
            const overrides: ISourceMapPathOverrides = { '/another/${webRoot}/src': '/app/${webRoot}/src'};
            assert.deepEqual(
                resolveWebRootPattern(WEBROOT, overrides),
                overrides);
        });

        test('works on a set of overrides', () => {
            const overrides: ISourceMapPathOverrides = {
                '/src*': '${webRoot}/app',
                '*/app.js': '*/app.js',
                '/src/app.js': '/src/${webRoot}',
                '/app.js': '${webRoot}/app.js',
                '${webRoot}/app1.js': '${webRoot}/app.js'
            };

            const expOverrides: ISourceMapPathOverrides = {
                '/src*': WEBROOT + '/app',
                '*/app.js': '*/app.js',
                '/src/app.js': '/src/${webRoot}',
                '/app.js': WEBROOT + '/app.js',
                [WEBROOT + '/app1.js']: WEBROOT + '/app.js'
            };

            assert.deepEqual(
                resolveWebRootPattern(WEBROOT, overrides),
                expOverrides);
        });
    });
});
