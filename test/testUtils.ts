/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as path from 'path';
import * as sinon from 'sinon';
import * as mockery from 'mockery';

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
export function getSinonMock(mockBase = {}): Sinon.SinonMock {
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
 * Creates a sinon mock and registers it with mockery.
 * @param requireName - The import path to register with mockery
 * @param mockInstance - The object to use as a sinon mock base object
 * @param name - If specified, mock is registered as { [name]: mockInstance }. e.g. if mocking a class.
 * @param asConstructor - If true, the mock instance will be returned when the named mock is called as a constructor
 */
export function createRegisteredSinonMock(requireName: string, mockInstance = {}, name?: string, asConstructor = true): Sinon.SinonMock {
    const mock = getSinonMock(mockInstance);
    let mockContainer: any;
    if (name) {
        mockContainer = {};
        if (asConstructor) {
            mockContainer[name] = () => mockInstance;
        } else {
            mockContainer[name] = mockInstance;
        }
    } else {
        mockContainer = mockInstance;
    }

    mockery.registerMock(requireName, mockContainer);

    return mock;
}

/**
 * Return a base Utilities mock that has Logger.log stubbed out
 */
export function getDefaultUtilitiesMock(): any {
    return {
        Logger: { log: () => { } },
        canonicalizeUrl: url => url
    };
}

export function registerEmptyMocks(moduleNames: string | string[]): void {
    if (typeof moduleNames === 'string') {
        moduleNames = [<string>moduleNames];
    }

    (<string[]>moduleNames).forEach(name => {
        mockery.registerMock(name, {});
    });
}

export function getStackTraceResponseBody(aPath: string, lines: number[], sourceReferences: number[] = []): IStackTraceResponseBody {
    return {
        stackFrames: lines.map((line, i) => ({
            id: i,
            name: 'line ' + i,
            line,
            column: 0,
            source: {
                path: aPath,
                name: path.basename(aPath),
                sourceReference: sourceReferences[i] || 0
            }
        }))
    };
}

export function win32Mocks(): void {
    mockery.registerMock('os', { platform: () => 'win32' });
    mockery.registerMock('path', path.win32);
}
