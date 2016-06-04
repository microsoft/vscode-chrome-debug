/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {DebugProtocol} from 'vscode-debugprotocol';

import {IStackTraceResponseBody} from '../src/chrome/debugAdapterInterfaces';

import * as path from 'path';
import * as sinon from 'sinon';
import * as mockery from 'mockery';

export function setupUnhandledRejectionListener(): void {
    process.addListener('unhandledRejection', unhandledRejectionListener);
}

export function removeUnhandledRejectionListener(): void {
    process.removeListener('unhandledRejection', unhandledRejectionListener);
}

function unhandledRejectionListener(reason: any, p: Promise<any>) {
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
export function getSinonMock(mockBase: any = {}): Sinon.SinonMock {
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
export function createRegisteredSinonMock(requireName: string, mockInstance: any = {}, name?: string, asConstructor = true): Sinon.SinonMock {
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

export function registerEmptyMocks(...moduleNames: string[]): void {
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

/**
 * Some tests use this to override 'os' and 'path' with the windows versions for consistency when running on different
 * platforms. For other tests, it either doesn't matter, or they have platform-specific test code.
 */
export function registerWin32Mocks(): void {
    mockery.registerMock('os', { platform: () => 'win32' });
    mockery.registerMock('path', path.win32);
}
