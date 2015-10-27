/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as mockery from 'mockery';
import * as assert from 'assert';
import * as testUtils from '../testUtils';

import {EventEmitter} from 'events';

/** Utilities without mocks - use for type only */
import {WebKitDebugAdapter as _WebKitDebugAdapter} from '../../webkit/webKitDebugAdapter';

const MODULE_UNDER_TEST = '../../webkit/webKitDebugAdapter';
suite('WebKitDebugAdapter', () => {
    let webKitConnectionMock: Sinon.SinonMock;

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

        webKitConnectionMock = registerMockWebKitConnection();
        mockery.registerMock('child_process', { });
        mockery.registerMock('url', { });
        mockery.registerMock('path', { });
        mockery.registerMock('os', { });
        mockery.registerMock('net', { });
        mockery.registerMock('fs', { });
    });

    teardown(() => {
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
            registerMockWebKitConnection({
                attach: () => Promise.reject('Testing attach failed')
            });

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
        test('works', () => {
            const wkda = instantiateWKDA();
            return attach(wkda).then(() => {
                webKitConnectionMock
                    .expects('debugger_setBreakpoint')
                    .withArgs({ scriptId: "id", lineNumber: 5, columnNumber: 0 });
                DefaultMockWebKitConnection.EE.emit('Debugger.scriptParsed', { id: "id", url: "a.js" });
                return wkda.setBreakpoints({ source: { path: "a.js" }, lines: [5] });
            }).then(response => {
                webKitConnectionMock.verify();
                assert.deepEqual(response.breakpoints.length, 1);
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
 * Registers a mock WebKitConnection based off the above default impl, patched when whatever is in partialImpl
 */
function registerMockWebKitConnection(partialImpl?: any): Sinon.SinonMock {
    const mockType = () => { };
    Object.getOwnPropertyNames(DefaultMockWebKitConnection).forEach(name => {
        mockType[name] = DefaultMockWebKitConnection[name];
    });

    if (partialImpl) {
        Object.getOwnPropertyNames(partialImpl).forEach(name => {
            mockType[name] = partialImpl[name];
        });
    }

    // Instantiate the mock type so we can wrap it in a sinon mock
    const mock = sinon.mock(new mockType());

    // Register a fake constructor so that our instance will be called when the adapter does 'new WebKitConnection'
    mockery.registerMock('./webKitConnection', { WebKitConnection: () => mock });

    return mock;
}

function instantiateWKDA(): _WebKitDebugAdapter {
    const WebKitDebugAdapter: typeof _WebKitDebugAdapter = require(MODULE_UNDER_TEST).WebKitDebugAdapter;
    return new WebKitDebugAdapter();
}
