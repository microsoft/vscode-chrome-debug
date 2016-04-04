/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from 'assert';

import * as testUtils from '../testUtils';
import {AdapterProxy} from '../../src/adapterProxy';

suite('AdapterProxy', () => {
    setup(() => {
        testUtils.setupUnhandledRejectionListener();
    });

    teardown(() => {
        testUtils.removeUnhandledRejectionListener();
    });

    suite('request', () => {
        test('if an unknown command is issued, dispatchRequest fails', () => {
            const ap = new AdapterProxy(null, <any>{ registerEventHandler: () => { } }, null);
            return ap.dispatchRequest(<any>{ command: 'abc' }).then(
                () => assert.fail('Expected to fail'),
                e => {
                    assert.equal(e.message, 'unknowncommand');
                });
        });
    });
});