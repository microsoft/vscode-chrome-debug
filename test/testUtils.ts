/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {DebugProtocol} from 'vscode-debugprotocol';

import {IStackTraceResponseBody} from '../src/debugAdapterInterfaces';
import * as utils from '../src/utils';

import {Mock, It, MockBehavior} from 'typemoq';
import * as path from 'path';
import * as mockery from 'mockery';
import * as fs from 'fs';

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

export function registerOSXMocks(): void {
    mockery.registerMock('os', { platform: () => 'darwin' });
    mockery.registerMock('path', path.posix);
}

/**
 * path.resolve + fixing the drive letter to match what VS Code does. Basically tests can use this when they
 * want to force a path to native slashes and the correct letter case, but maybe can't use un-mocked utils.
 */
export function pathResolve(...segments: string[]): string {
    let aPath = path.resolve.apply(null, segments);

    if (aPath.match(/^[A-Za-z]:/)) {
        aPath = aPath[0].toLowerCase() + aPath.substr(1);
    }

    return aPath;
}

export function registerMockReadFile(...entries: { absPath: string; data: string }[]): void {
    const fsMock = Mock.ofInstance(fs, MockBehavior.Strict);
    mockery.registerMock('fs', fsMock.object);

    entries.forEach(entry => {
        fsMock
            .setup(x => x.readFile(It.isValue(entry.absPath), It.isAny()))
            .callback((path, callback) => callback(null, entry.data));
    });
}

/**
 * Mock utils.getURL to return the specified contents.
 * Note that if you call this twice, the second call will overwrite the first.
 */
export function registerMockGetURL(utilsRelativePath: string, url: string, contents: string, isError = false): void {
    const utilsMock = Mock.ofInstance(utils);
    utilsMock.callBase = true;
    mockery.registerMock(utilsRelativePath, utilsMock.object);
    utilsMock
        .setup(x => x.getURL(It.isValue(url)))
        .returns(() => isError ? Promise.reject(contents) : Promise.resolve(contents));
    utilsMock
        .setup(x => x.isURL(It.isValue(url)))
        .returns(() => true);
}

export function registerMockGetURLFail(utilsRelativePath: string, url: string, failContents?: string): void {
    return registerMockGetURL(utilsRelativePath, url, failContents, /*isError=*/true);
}

/**
 * Returns a promise that is resolved if the given promise is rejected, and is rejected if the given
 * promise is resolved
 */
export function assertPromiseRejected(promise: Promise<any>): Promise<any> {
    return promise.then(
        result => { throw new Error('Promise was expected to be rejected, but was resolved with ' + result); },
        () => { /* as expected */ });
}
