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

    class SomethingElse {
        public helper(arg: any): number {
            return 5;
        }
    }

    class ToTest {
        public testMe(s: SomethingElse): number {
            return s.helper({ a: { b: 1 } });
        }
    }

    suite('asdf()', () => {
        test('sinontest', () => {
            let s: SomethingElse = new SomethingElse();
            let m = sinon.mock(s);
            m.expects('helper')
                .once()
                .withArgs(1).returns(2)
                .withArgs({ a: { b: 1 } }).returns(4);

            assert.equal(new ToTest().testMe(s), 4);
            mockWebKitConnection.verify();
        });
    });

    suite('setBreakpoints()', () => {
        test('When setting one breakpoint, returns the correct result', () => {
            // Set up connection mock
            mockWebKitConnection.expects('debugger_setBreakpoint')
                .once()
                .withArgs(<WebKitProtocol.Debugger.Location>{ scriptId: 'id', lineNumber: 5, columnNumber: 0 })
                .returns(<WebKitProtocol.Debugger.SetBreakpointResponse>{ id: 0, result: { breakpointId: 'bpId', actualLocation: { scriptId: 'id', lineNumber: 5, columnNumber: 0 } } });

            const wkda = instantiateWKDA();
            return attach(wkda).then(() => {
                DefaultMockWebKitConnection.EE.emit('Debugger.scriptParsed', { scriptId: 'id', url: 'file:///a.js' });
                return wkda.setBreakpoints({ source: { path: 'a.js' }, lines: [5] });
            }).then(response => {
                mockWebKitConnection.verify();
                assert.deepEqual(response, { breakpoints: [{ line: 5, column: 0, verified: true }] });
            });
        });
    });

    suite('launch()', () => { });
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
    return wkda.attach({ address: 'localhost', 'port': 9222 });
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
        mockInstance[methodName] = () => Promise.resolve();
        return originalMExpects(methodName);
    };

    return m;
}

function instantiateWKDA(): _WebKitDebugAdapter {
    const WebKitDebugAdapter: typeof _WebKitDebugAdapter = require(MODULE_UNDER_TEST).WebKitDebugAdapter;
    return new WebKitDebugAdapter();
}
