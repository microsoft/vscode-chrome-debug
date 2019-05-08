/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as tmp from 'tmp';
import * as puppeteer from 'puppeteer';

import * as ts from 'vscode-chrome-debug-core-testsupport';
import { ILaunchRequestArgs } from '../../src/chromeDebugInterfaces';
import { Dictionary } from 'lodash';
import { logCallsTo, getDebugAdapterLogFilePath, setTestLogName } from './utils/logging';
import { IBeforeAndAfterContext } from 'mocha';
import { execSync } from 'child_process';
import { killAllChrome } from '../testUtils';

const DEBUG_ADAPTER = './out/src/chromeDebug.js';

let testLaunchProps: ILaunchRequestArgs & Dictionary<unknown> | undefined;

export const isThisV2 = true;
export const isThisV1 = !isThisV2;
export const isWindows = process.platform === 'win32';

function formLaunchArgs(launchArgs: ILaunchRequestArgs & Dictionary<unknown>, testTitle: string): void {
    launchArgs.trace = 'verbose';
    launchArgs.logTimestamps = true;
    launchArgs.disableNetworkCache = true;
    launchArgs.logFilePath = getDebugAdapterLogFilePath(testTitle);

    if (!launchArgs.runtimeExecutable) {
        launchArgs.runtimeExecutable = puppeteer.executablePath();
    }

    // Start with a clean userDataDir for each test run
    const tmpDir = tmp.dirSync({ prefix: 'chrome2-' });
    launchArgs.userDataDir = tmpDir.name;
    if (testLaunchProps) {
        for (let key in testLaunchProps) {
            launchArgs[key] = testLaunchProps[key];
        }
        testLaunchProps = undefined;
    }
}

function patchLaunchArgs(launchArgs: ILaunchRequestArgs, testTitle: string): void {
    formLaunchArgs(launchArgs, testTitle);
}

export const lowercaseDriveLetterDirname = __dirname.charAt(0).toLowerCase() + __dirname.substr(1);
export const PROJECT_ROOT = path.join(lowercaseDriveLetterDirname, '../../../');
export const DATA_ROOT = path.join(PROJECT_ROOT, 'testdata/');

export async function setup(context: IBeforeAndAfterContext, port?: number, launchProps?: ILaunchRequestArgs) {
    const testTitle = context.currentTest.fullTitle();
    setTestLogName(testTitle);

    if (!port) {
        const daPort = process.env['MSFT_TEST_DA_PORT'];
        port = daPort
            ? parseInt(daPort, 10)
            : undefined;
    }

    if (launchProps) {
        testLaunchProps = launchProps;
    }

    const debugClient = await ts.setup({ entryPoint: DEBUG_ADAPTER, type: 'chrome', patchLaunchArgs: args => patchLaunchArgs(args, testTitle), port: port });
    debugClient.defaultTimeout = 10000/*ms*/; // The VSTS agents run slower than our machines

    const wrappedDebugClient = logCallsTo(debugClient, 'DebugAdapterClient');
    return wrappedDebugClient;
}

export async function teardown() {
    await ts.teardown();

    if (process.platform === 'win32' && process.env.TF_BUILD) {
        // We only need to kill the chrome.exe instances on the Windows agent
        // TODO: Figure out a way to remove this
        killAllChrome();
    }
}
