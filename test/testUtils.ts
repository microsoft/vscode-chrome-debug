/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as sinon from 'sinon';

export function setupUnhandledRejectionListener(): void {
    process.addListener('unhandledRejection', unhandledRejectionListener);
}

export function removeUnhandledRejectionListener(): void {
    process.removeListener('unhandledRejection', unhandledRejectionListener);
}

function unhandledRejectionListener(reason, p) {
    console.log('*');
    console.log('**');
    console.log('***');
    console.log('****');
    console.log('*****');
    console.log(`ERROR!! Unhandled promise rejection, a previous test may have failed but reported success.`);
    console.log(reason.toString());
    console.log('*****');
    console.log('****');
    console.log('***');
    console.log('**');
    console.log('*');
}

export class MockEvent implements DebugProtocol.Event {
    public seq = 0;
    public type = 'event';

    constructor(public event: string, public body?: any) { }
}

/**
 * Calls sinon.mock and patches its 'expects' method to not expect that the mock base object
 * already has an implementation of the expected method.
 */
export function getSinonMock(mockBase: any): Sinon.SinonMock {
    const m = sinon.mock(mockBase);

    // Add a default implementation of every expected method so sinon doesn't complain if it doesn't exist.
    const originalMExpects = m.expects.bind(m);
    m.expects = methodName => {
        if (!mockBase[methodName]) {
            mockBase[methodName] = () => Promise.resolve();
        }

        return originalMExpects(methodName);
    };

    return m;
}

/**
 * Return a base Utilities mock that has Logger.log stubbed out
 */
export function getDefaultUtilitiesMock(): any {
    return {
        Logger: { log: () => { } }
    };
}
