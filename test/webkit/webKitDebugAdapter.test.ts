/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as mockery from 'mockery';
import * as assert from 'assert';

/** Utilities without mocks - use for type only */
import * as _Utilities from '../../webkit/webKitDebugAdapter';

const MODULE_UNDER_TEST = '../../webkit/webKitDebugAdapter';
suite('WebKitDebugAdapter', () => {
    setup(() => {
        mockery.enable({ useCleanCache: true, warnOnReplace: false });
        mockery.registerAllowable(MODULE_UNDER_TEST);
        mockery.registerAllowable('../common/debugSession');
        mockery.registerAllowable('../common/handles');

        mockery.registerMock('./webKitConnection', { });
        mockery.registerMock('./utilities', { });
        mockery.registerMock('child_process', { });
        mockery.registerMock('url', { });
        mockery.registerMock('path', { });
        mockery.registerMock('os', { });
    });

    teardown(() => {
        mockery.deregisterAll();
        mockery.disable();
    });

    suite('launch()', () => {
        
    });
});