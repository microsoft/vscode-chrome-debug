/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as sinon from 'sinon';
import * as mockery from 'mockery';
import {EventEmitter} from 'events';
import * as assert from 'assert';

import * as testUtils from '../testUtils';

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
            'events']);

        mockery.registerMock('os', { platform: () => 'win32' });
        mockery.registerMock('child_process', {});
        mockery.registerMock('url', {});
        mockery.registerMock('path', {});
        mockery.registerMock('net', {});
        mockery.registerMock('fs', {});

        mockWebKitConnection = registerMockWebKitConnection();
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
            mockWebKitConnection.expects('attach').returns(Promise.reject('Testing attach failed'));

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
        const SCRIPT_ID = 'id';
        const BP_ID = 'bpId';
        const FILE_NAME = 'file:///a.js';
        function expectSetBreakpoint(lines: number[], cols?: number[]): void {
            lines.forEach((lineNumber, i) => {
                let columnNumber;
                if (cols) {
                    columnNumber = cols[i];
                }

                mockWebKitConnection.expects('debugger_setBreakpoint')
                    .once()
                    .withArgs(<WebKitProtocol.Debugger.Location>{ scriptId: SCRIPT_ID, lineNumber, columnNumber })
                    .returns(<WebKitProtocol.Debugger.SetBreakpointResponse>{ id: 0, result: { breakpointId: BP_ID + i, actualLocation: { scriptId: SCRIPT_ID, lineNumber, columnNumber } } });
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

        function makeExpectedResponse(lines: number[], cols?: number[]): SetBreakpointsResponseBody {
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
                DefaultMockWebKitConnection.EE.emit('Debugger.scriptParsed', { scriptId: SCRIPT_ID, url: FILE_NAME });
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
                DefaultMockWebKitConnection.EE.emit('Debugger.scriptParsed', { scriptId: SCRIPT_ID, url: FILE_NAME });
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
                DefaultMockWebKitConnection.EE.emit('Debugger.scriptParsed', { scriptId: SCRIPT_ID, url: FILE_NAME });
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
    });

    suite('launch()', () => {
        test('launches with minimal correct args', () => {
            let spawnCalled = false;
            function spawn(chromePath: string, args: string[]): any {
                // Just assert that the chrome path is some string with 'chrome' in the path, and there are >0 args
                assert(chromePath.toLowerCase().indexOf('chrome') >= 0);
                assert(args.indexOf('--remote-debugging-port=9222') >= 0);
                assert(args.indexOf('a.js') >= 0);
                assert(args.indexOf('abc') >= 0);
                assert(args.indexOf('def') >= 0);
                spawnCalled = true;

                return { on: () => { } };
            }

            mockery.registerMock('child_process', { spawn });
            mockery.registerMock('fs', { statSync: () => true });
            mockery.registerMock('os', {
                tmpdir: () => 'c:/tmp',
                platform: () => 'win32'
            });
            const wkda = instantiateWKDA();
            return wkda.launch({ program: 'a.js', runtimeArguments: ['abc', 'def'], workingDirectory: 'c:/' }).then(() => {
                assert(spawnCalled);
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
    return wkda.attach({ address: '127.0.0.1', 'port': 9222 });
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

/**
 * Creates an instance of the default mock WKC, registers it with mockery.
 * Then creates a sinon mock against it, and customizes sinon's 'expects'
 */
function registerMockWebKitConnection(): Sinon.SinonMock {
    const mockInstance = new DefaultMockWebKitConnection();
    mockery.registerMock('./webKitConnection', { WebKitConnection: () => mockInstance });
    const m = sinon.mock(mockInstance);

    // Prevent sinon from complaining that the mocked object doesn't have an implementation of
    // the expected method.
    const originalMExpects = m.expects.bind(m);
    m.expects = methodName => {
        if (!mockInstance[methodName]) {
            mockInstance[methodName] = () => Promise.resolve();
        }

        return originalMExpects(methodName);
    };

    return m;
}

function instantiateWKDA(): _WebKitDebugAdapter {
    const WebKitDebugAdapter: typeof _WebKitDebugAdapter = require(MODULE_UNDER_TEST).WebKitDebugAdapter;
    return new WebKitDebugAdapter();
}
