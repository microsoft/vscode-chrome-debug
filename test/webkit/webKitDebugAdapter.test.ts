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

        mockery.registerMock('./webKitConnection', { WebKitConnection: MockWebKitConnection });
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
        test('fail', done => done('failed!!!!'));
        test('if successful, an initialized event is fired', done => {
            const WebKitDebugAdapter: typeof _WebKitDebugAdapter = require(MODULE_UNDER_TEST).WebKitDebugAdapter;
            const wkda = new WebKitDebugAdapter();

            let initializedFired = false;
            wkda.registerEventHandler((event: DebugProtocol.Event) => {
                if (event.type === 'initialize2') {
                    initializedFired = true;
                } else {
                    assert.fail('An unexpected event was fired');
                }
            });

            wkda.attach({ address: 'localhost', 'port': 9222 }).then(() => {
                if (initializedFired) {
                    done();
                } else {
                    assert.fail('Attach completed without firing the initialized event');
                }
            });
        });
    });
});

class MockWebKitConnection {
    public on(eventName: string, handler: (msg: any) => void): void {
    }

    public attach(port: number): Promise<void> {
        return Promise.resolve<void>();
    }
}
