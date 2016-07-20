/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {DebugProtocol} from 'vscode-debugprotocol';

import {ISetBreakpointsResponseBody} from '../../src/debugAdapterInterfaces';
import * as Chrome from '../../src/chrome/chromeDebugProtocol';
import {ChromeConnection} from '../../src/chrome/chromeConnection';

import * as mockery from 'mockery';
import {EventEmitter} from 'events';
import * as assert from 'assert';
import {Mock, MockBehavior, It} from 'typemoq';

import * as testUtils from '../testUtils';
import * as utils from '../../src/utils';

/** Not mocked - use for type only */
import {ChromeDebugAdapter as _ChromeDebugAdapter} from '../../src/chrome/chromeDebugAdapter';

const MODULE_UNDER_TEST = '../../src/chrome/chromeDebugAdapter';
suite('ChromeDebugAdapter', () => {
    const ATTACH_ARGS = { port: 9222 };

    let mockChromeConnection: Mock<ChromeConnection>;
    let mockEventEmitter: EventEmitter;

    let chromeDebugAdapter: _ChromeDebugAdapter;

    setup(() => {
        testUtils.setupUnhandledRejectionListener();
        mockery.enable({ useCleanCache: true, warnOnReplace: false, warnOnUnregistered: false });
        testUtils.registerWin32Mocks();

        // Create a ChromeConnection mock with .on and .attach. Tests can fire events via mockEventEmitter
        mockEventEmitter = new EventEmitter();
        mockChromeConnection = Mock.ofType(ChromeConnection, MockBehavior.Strict);
        mockChromeConnection
            .setup(x => x.on(It.isAnyString(), It.isAny()))
            .callback((eventName: string, handler: (msg: any) => void) => mockEventEmitter.on(eventName, handler));
        mockChromeConnection
            .setup(x => x.attach(It.isValue(undefined), It.isAnyNumber(), It.isValue(undefined)))
            .returns(() => Promise.resolve<void>());
        mockChromeConnection
            .setup(x => x.isAttached)
            .returns(() => false);

        // Instantiate the ChromeDebugAdapter, injecting the mock ChromeConnection
        chromeDebugAdapter = new (require(MODULE_UNDER_TEST).ChromeDebugAdapter)(mockChromeConnection.object);
    });

    teardown(() => {
        testUtils.removeUnhandledRejectionListener();
        mockery.deregisterAll();
        mockery.disable();
        mockChromeConnection.verifyAll();
    });

    suite('attach()', () => {
        test('if successful, an initialized event is fired', () => {
            let initializedFired = false;

            chromeDebugAdapter.registerEventHandler((event: DebugProtocol.Event) => {
                if (event.event === 'initialized') {
                    initializedFired = true;
                } else {
                    assert.fail('An unexpected event was fired');
                }
            });

            return chromeDebugAdapter.attach(ATTACH_ARGS).then(() => {
                assert(initializedFired, 'Attach completed without firing the initialized event');
            });
        });

        test('if unsuccessful, the promise is rejected and an initialized event is not fired', () => {
            mockChromeConnection
                .setup(x => x.attach(It.isValue(undefined), It.isAnyNumber()))
                .returns(() => utils.errP('Testing attach failed'));

            chromeDebugAdapter.registerEventHandler((event: DebugProtocol.Event) => {
                assert.fail('Not expecting any event in this scenario');
            });

            return chromeDebugAdapter.attach(ATTACH_ARGS).then(
                () => assert.fail('Expecting promise to be rejected'),
                e => { /* Expecting promise to be rejected */ });
        });
    });

    suite('setBreakpoints()', () => {
        const BP_ID = 'bpId';
        const FILE_NAME = 'file:///a.js';
        const SCRIPT_ID = '1';
        function expectSetBreakpoint(lines: number[], cols: number[], url: string, scriptId = SCRIPT_ID): void {
            lines.forEach((lineNumber, i) => {
                const columnNumber = cols[i];

                if (url) {
                    mockChromeConnection
                        .setup(x => x.debugger_setBreakpointByUrl(url, lineNumber, columnNumber))
                        .returns(location => Promise.resolve(
                            <Chrome.Debugger.SetBreakpointByUrlResponse>{ id: 0, result: { breakpointId: BP_ID + i, locations: [{ scriptId, lineNumber, columnNumber }] } }))
                        .verifiable();
                } else {
                    mockChromeConnection
                        .setup(x => x.debugger_setBreakpoint(It.isAny()))
                        .returns(location => Promise.resolve(
                            <Chrome.Debugger.SetBreakpointResponse>{ id: 0, result: { breakpointId: BP_ID + i, actualLocation: { scriptId, lineNumber, columnNumber } } }))
                        .verifiable();
                }
            });
        }

        function expectRemoveBreakpoint(indicies: number[]): void {
            indicies.forEach(i => {
                mockChromeConnection
                    .setup(x => x.debugger_removeBreakpoint(It.isValue(BP_ID + i)))
                    .returns(() => Promise.resolve(<Chrome.Response>{ id: 0 }))
                    .verifiable();
            });
        }

        function makeExpectedResponse(lines: number[], cols?: number[]): ISetBreakpointsResponseBody {
            const breakpoints = lines.map((line, i) => ({
                line,
                column: cols ? cols[i] : 0,
                verified: true
            }));

            return { breakpoints };
        }

        function emitScriptParsed(url = FILE_NAME, scriptId = SCRIPT_ID): void {
            mockEventEmitter.emit('Debugger.scriptParsed', <Chrome.Debugger.Script>{ scriptId, url });
        }

        test('When setting one breakpoint, returns the correct result', () => {
            const lines = [5];
            const cols = [6];
            expectSetBreakpoint(lines, cols, FILE_NAME);

            return chromeDebugAdapter.attach(ATTACH_ARGS)
                .then(() => emitScriptParsed())
                .then(() => chromeDebugAdapter.setBreakpoints({ source: { path: FILE_NAME }, lines, cols }))
                .then(response => assert.deepEqual(response, makeExpectedResponse(lines, cols)));
        });

        test('When setting multiple breakpoints, returns the correct result', () => {
            const lines = [14, 200, 151];
            const cols = [33, 16, 1];
            expectSetBreakpoint(lines, cols, FILE_NAME);

            return chromeDebugAdapter.attach(ATTACH_ARGS)
                .then(() => emitScriptParsed())
                .then(() => chromeDebugAdapter.setBreakpoints({ source: { path: FILE_NAME }, lines, cols }))
                .then(response => assert.deepEqual(response, makeExpectedResponse(lines, cols)));
        });

        test('The adapter clears all previous breakpoints in a script before setting the new ones', () => {
            const lines = [14, 200];
            const cols = [33, 16];
            expectSetBreakpoint(lines, cols, FILE_NAME);

            return chromeDebugAdapter.attach(ATTACH_ARGS)
                .then(() => emitScriptParsed())
                .then(() => chromeDebugAdapter.setBreakpoints({ source: { path: FILE_NAME }, lines, cols }))
                .then(response => {
                    lines.push(321);
                    cols.push(123);

                    expectRemoveBreakpoint([0, 1]);
                    expectSetBreakpoint(lines, cols, FILE_NAME);

                    return chromeDebugAdapter.setBreakpoints({ source: { path: FILE_NAME }, lines, cols });
                })
                .then(response => assert.deepEqual(response, makeExpectedResponse(lines, cols)));
        });

        test('The adapter handles removing a breakpoint', () => {
            const lines = [14, 200];
            const cols = [33, 16];
            expectSetBreakpoint(lines, cols, FILE_NAME);

            return chromeDebugAdapter.attach(ATTACH_ARGS)
                .then(() => emitScriptParsed())
                .then(() => chromeDebugAdapter.setBreakpoints({ source: { path: FILE_NAME }, lines, cols }))
                .then(response => {
                    lines.shift();
                    cols.shift();

                    expectRemoveBreakpoint([0, 1]);
                    expectSetBreakpoint(lines, cols, FILE_NAME);
                    return chromeDebugAdapter.setBreakpoints({ source: { path: FILE_NAME }, lines, cols });
                })
                .then(response => assert.deepEqual(response, makeExpectedResponse(lines, cols)));
        });

        test('After a page refresh, clears the newly resolved breakpoints before adding new ones', () => {
            const lines = [14, 200];
            const cols = [33, 16];
            expectSetBreakpoint(lines, cols, FILE_NAME);

            return chromeDebugAdapter.attach(ATTACH_ARGS)
                .then(() => emitScriptParsed())
                .then(() => chromeDebugAdapter.setBreakpoints({ source: { path: FILE_NAME }, lines, cols }))
                .then(response => {
                    expectRemoveBreakpoint([2, 3]);
                    mockEventEmitter.emit('Debugger.globalObjectCleared');
                    mockEventEmitter.emit('Debugger.scriptParsed', <Chrome.Debugger.Script>{ scriptId: 'afterRefreshScriptId', url: FILE_NAME });
                    mockEventEmitter.emit('Debugger.breakpointResolved', <Chrome.Debugger.BreakpointResolvedParams>{ breakpointId: BP_ID + 2, location: { scriptId: 'afterRefreshScriptId' } });
                    mockEventEmitter.emit('Debugger.breakpointResolved', <Chrome.Debugger.BreakpointResolvedParams>{ breakpointId: BP_ID + 3, location: { scriptId: 'afterRefreshScriptId' } });

                    lines.push(321);
                    cols.push(123);
                    expectSetBreakpoint(lines, cols, FILE_NAME, 'afterRefreshScriptId');
                    return chromeDebugAdapter.setBreakpoints({ source: { path: FILE_NAME }, lines, cols });
                })
                .then(response => assert.deepEqual(response, makeExpectedResponse(lines, cols)));
        });

        test('returns the actual location specified by the runtime', () => {
            const lines = [5];
            const cols = [6];

            // Set up the mock to return a different location
            const location: Chrome.Debugger.Location = {
                scriptId: SCRIPT_ID, lineNumber: lines[0] + 10, columnNumber: cols[0] + 10 };
            const expectedResponse: ISetBreakpointsResponseBody = {
                breakpoints: [{ line: location.lineNumber, column: location.columnNumber, verified: true }]};

            mockChromeConnection
                .setup(x => x.debugger_setBreakpointByUrl(FILE_NAME, lines[0], cols[0]))
                .returns(() => Promise.resolve(
                    <Chrome.Debugger.SetBreakpointByUrlResponse>{ id: 0, result: { breakpointId: BP_ID, locations: [location] } }))
                .verifiable();

            return chromeDebugAdapter.attach(ATTACH_ARGS)
                .then(() => emitScriptParsed())
                .then(() => chromeDebugAdapter.setBreakpoints({ source: { path: FILE_NAME }, lines, cols }))
                .then(response => assert.deepEqual(response, expectedResponse));
        });

        test('setting breakpoints in a sourcemapped eval script handles the placeholder url', () => {
            const lines = [5];
            const cols = [6];
            expectSetBreakpoint(lines, cols, '');

            return chromeDebugAdapter.attach(ATTACH_ARGS)
                .then(() => emitScriptParsed(/*url=*/'', SCRIPT_ID))
                .then(() => chromeDebugAdapter.setBreakpoints({ source: { path: 'debugadapter://' + SCRIPT_ID }, lines, cols }))
                .then(response => assert.deepEqual(response, makeExpectedResponse(lines, cols)));
        });
    });

    suite('launch()', () => {
        test('launches with minimal correct args', () => {
            let spawnCalled = false;
            function spawn(chromePath: string, args: string[]): any {
                // Just assert that the chrome path is some string with 'chrome' in the path, and there are >0 args
                assert(chromePath.toLowerCase().indexOf('chrome') >= 0);
                assert(args.indexOf('--remote-debugging-port=9222') >= 0);
                assert(args.indexOf('file:///c:/path%20with%20space/index.html') >= 0);
                assert(args.indexOf('abc') >= 0);
                assert(args.indexOf('def') >= 0);
                spawnCalled = true;

                return { on: () => { }, unref: () => { } };
            }

            // Mock spawn for chrome process, and 'fs' for finding chrome.exe.
            // These are mocked as empty above - note that it's too late for mockery here.
            require('child_process').spawn = spawn;
            require('fs').statSync = () => true;

            mockChromeConnection
                .setup(x => x.attach(It.isValue(undefined), It.isAnyNumber(), It.isAnyString()))
                .returns(() => Promise.resolve<void>())
                .verifiable();

            return chromeDebugAdapter.launch({ file: 'c:\\path with space\\index.html', runtimeArgs: ['abc', 'def'] })
                .then(() => assert(spawnCalled));
        });
    });

    suite('Console.messageAdded', () => {
        test('Fires an output event when a console message is added', () => {
            const testLog = 'Hello, world!';
            let outputEventFired = false;
            chromeDebugAdapter.registerEventHandler((event: DebugProtocol.Event) => {
                if (event.event === 'output') {
                    outputEventFired = true;
                    assert.equal(event.body.text, testLog);
                } else {
                    assert.fail('An unexpected event was fired');
                }
            });

            mockEventEmitter.emit('Console.onMessageAdded', {
                message: {
                    source: 'console-api',
                    level: 'log',
                    type: 'log',
                    text: testLog,
                    timestamp: Date.now(),
                    line: 2,
                    column: 13,
                    url: 'file:///c:/page/script.js',
                    executionContextId: 2,
                    parameters: [
                        { type: 'string', value: testLog }
                    ]
                }
            });
        });
    });

    suite('Debugger.scriptParsed', () => {
        const FILE_NAME = 'file:///a.js';
        const SCRIPT_ID = '1';
        function emitScriptParsed(url = FILE_NAME, scriptId = SCRIPT_ID, otherArgs: any = {}): void {
            otherArgs.url = url;
            otherArgs.scriptId = scriptId;

            mockEventEmitter.emit('Debugger.scriptParsed', otherArgs);
        }

        test('adds default url when missing', () => {
            let scriptParsedFired = false;
            return chromeDebugAdapter.attach(ATTACH_ARGS).then(() => {
                chromeDebugAdapter.registerEventHandler((event: DebugProtocol.Event) => {
                    if (event.event === 'scriptParsed') {
                        // Assert that the event is fired with some scriptUrl
                        scriptParsedFired = true;
                        assert(event.body.scriptUrl);
                    } else {
                        assert.fail('An unexpected event was fired: ' + event.event);
                    }
                });

                emitScriptParsed(/*url=*/'');
                assert(scriptParsedFired);
            });
        });

        test('ignores internal scripts', () => {
            return chromeDebugAdapter.attach(ATTACH_ARGS).then(() => {
                chromeDebugAdapter.registerEventHandler((event: DebugProtocol.Event) => {
                    assert.fail('No event should be fired: ' + event.event);
                });

                emitScriptParsed(/*url=*/'', undefined, { isInternalScript: true });
            });
        });
    });

    suite('setExceptionBreakpoints()', () => { });
    suite('stepping', () => { });
    suite('stackTrace()', () => { });
    suite('scopes()', () => { });
    suite('variables()', () => { });
    suite('source()', () => { });
    suite('threads()', () => { });
    suite('evaluate()', () => { });

    suite('Debugger.resume', () => { });
    suite('Debugger.pause', () => { });
    suite('target close/error/detach', () => { });
});
