/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as mockery from 'mockery';
import {EventEmitter} from 'events';
import * as assert from 'assert';

import * as testUtils from '../testUtils';
import * as utils from '../../webkit/utilities';

/** Not mocked - use for type only */
import {WebKitDebugAdapter as _WebKitDebugAdapter} from '../../webkit/webKitDebugAdapter';

const MODULE_UNDER_TEST = '../../webkit/webKitDebugAdapter';
suite('WebKitDebugAdapter', () => {
    let mockWebKitConnection: Sinon.SinonMock;

    setup(() => {
        testUtils.setupUnhandledRejectionListener();
        mockery.enable({ useCleanCache: true, warnOnReplace: false });
        mockery.registerAllowables([
            MODULE_UNDER_TEST,
            './utilities']);

        // Allow the common/ stuff - almost none of it is actually used but I can't get rid of the requires entirely
        mockery.registerAllowables([
            '../common/debugSession',
            '../common/handles',
            '../common/v8Protocol',
            './v8Protocol',
            './consoleHelper',
            'events']);

        mockery.registerMock('os', { platform: () => 'win32' });
        testUtils.registerEmptyMocks(['child_process', 'url', 'path', 'net', 'fs', 'http']);
        mockWebKitConnection = testUtils.createRegisteredSinonMock('./webKitConnection', new DefaultMockWebKitConnection(), 'WebKitConnection');
    });

    teardown(() => {
        DefaultMockWebKitConnection.EE.removeAllListeners();
        testUtils.removeUnhandledRejectionListener();
        mockery.deregisterAll();
        mockery.disable();
    });

    suite('attach()', () => {
        test('if successful, an initialized event is fired', () => {
            const wkda = instantiateWKDA();
            let initializedFired = false;
            wkda.registerEventHandler((event: DebugProtocol.Event) => {
                if (event.event === 'initialized') {
                    initializedFired = true;
                } else {
                    assert.fail('An unexpected event was fired');
                }
            });

            return attach(wkda).then(() => {
                if (!initializedFired) {
                    assert.fail('Attach completed without firing the initialized event');
                }
            });
        });

        test('if unsuccessful, the promise is rejected and an initialized event is not fired', done => {
            mockWebKitConnection.expects('attach').returns(utils.errP('Testing attach failed'));

            const wkda = instantiateWKDA();
            wkda.registerEventHandler((event: DebugProtocol.Event) => {
                assert.fail('Not expecting any event in this scenario');
            });

            return attach(wkda).then(
                () => assert.fail('Expecting promise to be rejected'),
                e => done());
        });
    });

    suite('setBreakpoints()', () => {
        const BP_ID = 'bpId';
        const FILE_NAME = 'file:///a.js';
        function expectSetBreakpoint(lines: number[], cols?: number[], scriptId: string = 'SCRIPT_ID'): void {
            lines.forEach((lineNumber, i) => {
                let columnNumber;
                if (cols) {
                    columnNumber = cols[i];
                }

                mockWebKitConnection.expects('debugger_setBreakpointByUrl')
                    .once()
                    .withArgs(FILE_NAME, lineNumber, columnNumber)
                    .returns(<WebKitProtocol.Debugger.SetBreakpointByUrlResponse>{ id: 0, result: { breakpointId: BP_ID + i, locations: [{ scriptId, lineNumber, columnNumber }] } });
            });
        }

        function expectRemoveBreakpoint(indicies: number[]): void {
            indicies.forEach(i => {
                mockWebKitConnection.expects('debugger_removeBreakpoint')
                    .once()
                    .withArgs(BP_ID + i)
                    .returns(<WebKitProtocol.Response>{ id: 0 });
            });
        }

        function makeExpectedResponse(lines: number[], cols?: number[]): ISetBreakpointsResponseBody {
            const breakpoints = lines.map((line, i) => ({
                line,
                column: cols ? cols[i] : 0,
                verified: true
            }));

            return {
                breakpoints
            };
        }

        test('When setting one breakpoint, returns the correct result', () => {
            const lines = [5];
            const cols = [6];
            expectSetBreakpoint(lines, cols);

            const wkda = instantiateWKDA();
            return attach(wkda).then(() => {
                return wkda.setBreakpoints({ source: { path: FILE_NAME }, lines, cols });
            }).then(response => {
                mockWebKitConnection.verify();
                assert.deepEqual(response, makeExpectedResponse(lines, cols));
            });
        });

        test('When setting multiple breakpoints, returns the correct result', () => {
            const lines = [14, 200, 151];
            const cols = [33, 16, 1];
            expectSetBreakpoint(lines, cols);

            const wkda = instantiateWKDA();
            return attach(wkda).then(() => {
                return wkda.setBreakpoints({ source: { path: FILE_NAME }, lines, cols });
            }).then(response => {
                mockWebKitConnection.verify();
                assert.deepEqual(response, makeExpectedResponse(lines, cols));
            });
        });

        test('The adapter clears all previous breakpoints in a script before setting the new ones', () => {
            const lines = [14, 200];
            const cols = [33, 16];
            expectSetBreakpoint(lines, cols);

            const wkda = instantiateWKDA();
            return attach(wkda).then(() => {
                return wkda.setBreakpoints({ source: { path: FILE_NAME }, lines, cols });
            }).then(response => {
                lines.push(321);
                cols.push(123);

                expectRemoveBreakpoint([0, 1]);
                expectSetBreakpoint(lines, cols);
                return wkda.setBreakpoints({ source: { path: FILE_NAME }, lines, cols });
            }).then(response => {
                mockWebKitConnection.verify();
                assert.deepEqual(response, makeExpectedResponse(lines, cols));
            });
        });

        test('The adapter handles removing a breakpoint', () => {
            const lines = [14, 200];
            const cols = [33, 16];
            expectSetBreakpoint(lines, cols);

            const wkda = instantiateWKDA();
            return attach(wkda).then(() => {
                return wkda.setBreakpoints({ source: { path: FILE_NAME }, lines, cols });
            }).then(response => {
                lines.shift();
                cols.shift();

                expectRemoveBreakpoint([0, 1]);
                expectSetBreakpoint(lines, cols);
                return wkda.setBreakpoints({ source: { path: FILE_NAME }, lines, cols });
            }).then(response => {
                mockWebKitConnection.verify();
                assert.deepEqual(response, makeExpectedResponse(lines, cols));
            });
        });

        test('After a page refresh, clears the newly resolved breakpoints before adding new ones', () => {
            const lines = [14, 200];
            const cols = [33, 16];
            expectSetBreakpoint(lines, cols);

            const wkda = instantiateWKDA();
            return attach(wkda).then(() => {
                return wkda.setBreakpoints({ source: { path: FILE_NAME }, lines, cols });
            }).then(response => {
                expectRemoveBreakpoint([2, 3]);
                DefaultMockWebKitConnection.EE.emit('Debugger.globalObjectCleared');
                DefaultMockWebKitConnection.EE.emit('Debugger.scriptParsed', <WebKitProtocol.Debugger.Script>{ scriptId: 'afterRefreshScriptId', url: FILE_NAME });
                DefaultMockWebKitConnection.EE.emit('Debugger.breakpointResolved', <WebKitProtocol.Debugger.BreakpointResolvedParams>{ breakpointId: BP_ID + 2, location: { scriptId: 'afterRefreshScriptId' } });
                DefaultMockWebKitConnection.EE.emit('Debugger.breakpointResolved', <WebKitProtocol.Debugger.BreakpointResolvedParams>{ breakpointId: BP_ID + 3, location: { scriptId: 'afterRefreshScriptId' } });

                lines.push(321);
                cols.push(123);
                expectSetBreakpoint(lines, cols, 'afterRefreshScriptId');
                return wkda.setBreakpoints({ source: { path: FILE_NAME }, lines, cols });
            }).then(response => {
                mockWebKitConnection.verify();
                assert.deepEqual(response, makeExpectedResponse(lines, cols));
            });
        });
    });

    suite('launch()', () => {
        test('launches with minimal correct args', () => {
            let spawnCalled = false;
            function spawn(chromePath: string, args: string[]): any {
                // Just assert that the chrome path is some string with 'chrome' in the path, and there are >0 args
                assert(chromePath.toLowerCase().indexOf('chrome') >= 0);
                assert(args.indexOf('--remote-debugging-port=9222') >= 0);
                assert(args.indexOf('file:///c:/a.js') >= 0);
                assert(args.indexOf('abc') >= 0);
                assert(args.indexOf('def') >= 0);
                spawnCalled = true;

                return { on: () => { }, unref: () => { } };
            }

            // actual path.resolve returns system-dependent slashes
            mockery.registerMock('path', { resolve: (a, b) => a + b });
            mockery.registerMock('child_process', { spawn });
            mockery.registerMock('fs', { statSync: () => true });
            mockery.registerMock('os', {
                tmpdir: () => 'c:/tmp',
                platform: () => 'win32'
            });
            const wkda = instantiateWKDA();
            return wkda.launch({ file: 'a.js', runtimeArgs: ['abc', 'def'], cwd: 'c:/' }).then(() => {
                assert(spawnCalled);
            });
        });
    });

    suite('Console.onMessageAdded', () => {
        test('Fires an output event when a console message is added', () => {
            const testLog = 'Hello, world!';
            const wkda = instantiateWKDA();
            let outputEventFired = false;
            wkda.registerEventHandler((event: DebugProtocol.Event) => {
                if (event.event === 'output') {
                    outputEventFired = true;
                    assert.equal(event.body.text, testLog);
                } else {
                    assert.fail('An unexpected event was fired');
                }
            });

            DefaultMockWebKitConnection.EE.emit('Console.onMessageAdded', {
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

function attach(wkda: _WebKitDebugAdapter): Promise<void> {
    return wkda.attach({ port: 9222, cwd: 'c:/' });
}

class DefaultMockWebKitConnection {
    public static EE = new EventEmitter();

    public on(eventName: string, handler: (msg: any) => void): void {
        DefaultMockWebKitConnection.EE.on(eventName, handler);
    }

    public attach(port: number): Promise<void> {
        return Promise.resolve<void>();
    }
}

function instantiateWKDA(): _WebKitDebugAdapter {
    const WebKitDebugAdapter: typeof _WebKitDebugAdapter = require(MODULE_UNDER_TEST).WebKitDebugAdapter;
    return new WebKitDebugAdapter();
}
