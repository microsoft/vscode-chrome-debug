/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as mockery from 'mockery';
import * as assert from 'assert';
import * as testUtils from '../testUtils';

/** Utilities without mocks - use for type only */
import {WebKitDebugAdapter as _WebKitDebugAdapter} from '../../webkit/webKitDebugAdapter';

const MODULE_UNDER_TEST = '../../webkit/webKitDebugAdapter';
suite('WebKitDebugAdapter', () => {
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

        registerMockWebKitConnection();
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

            return wkda.attach({ address: 'localhost', 'port': 9222 }).then(() => {
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

            return wkda.attach({ address: 'localhost', 'port': 9222 }).then(
                () => assert.fail('Expecting promise to be rejected'),
                e => done());
        });
    });
});

class DefaultMockWebKitConnection {
    public on(eventName: string, handler: (msg: any) => void): void {
    }

    public attach(port: number): Promise<void> {
        return Promise.resolve<void>();
    }
}

function registerMockWebKitConnection(partialImpl?: any): void {
    const mock = {};
    for (let name in DefaultMockWebKitConnection) {
        mock[name] = DefaultMockWebKitConnection[name];
    }

    for (let name in partialImpl) {
        mock[name] = partialImpl[name];
    }

    mockery.registerMock('./webKitConnection', { WebKitConnection: mock });
}

function instantiateWKDA(): _WebKitDebugAdapter {
    const WebKitDebugAdapter: typeof _WebKitDebugAdapter = require(MODULE_UNDER_TEST).WebKitDebugAdapter;
    return new WebKitDebugAdapter();
}
