/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from 'assert';
import * as mockery from 'mockery';

import * as testUtils from '../../testUtils';

const MODULE_UNDER_TEST = '../../../adapter/sourceMaps/pathUtilities';

suite('PathUtilities', () => {
    setup(() => {
        testUtils.setupUnhandledRejectionListener();

        // Set up mockery
        mockery.enable({ warnOnReplace: false, useCleanCache: true });
        mockery.registerAllowables([MODULE_UNDER_TEST, 'path', 'url', '../../webkit/utilities']);
    });

    teardown(() => {
        testUtils.removeUnhandledRejectionListener();
        mockery.deregisterAll();
        mockery.disable();
    });


    suite('getAbsSourceRoot', () => {
        
    });
});
