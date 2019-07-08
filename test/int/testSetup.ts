/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as tmp from 'tmp';
import * as puppeteer from 'puppeteer';
import * as _ from 'lodash';
import * as ts from 'vscode-chrome-debug-core-testsupport';

import { ILaunchRequestArgs } from '../../src/chromeDebugInterfaces';
import { Dictionary } from 'lodash';
import { logCallsTo, getDebugAdapterLogFilePath, setTestLogName } from './utils/logging';
import { IBeforeAndAfterContext, ITestCallbackContext } from 'mocha';
import { killAllChrome } from '../testUtils';
import { DefaultTimeoutMultiplier } from './utils/waitUntilReadyWithTimeout';

const DEBUG_ADAPTER = './out/src/chromeDebug.js';

let testLaunchProps: any | undefined; /* TODO: investigate why launch config types differ between V1 and V2 */

export const isThisV2 = false;
export const isThisV1 = !isThisV2;
export const isWindows = process.platform === 'win32';

// Note: marking launch args as any to avoid conflicts between v1 vs v2 launch arg types
/* TODO: investigate why launch config types differ between V1 and V2 */
function formLaunchArgs(launchArgs: any, testTitle: string): void {
    launchArgs.trace = 'verbose';
    launchArgs.logTimestamps = true;
    launchArgs.disableNetworkCache = true;
    launchArgs.logFilePath = getDebugAdapterLogFilePath(testTitle);

    if (!launchArgs.runtimeExecutable) {
        launchArgs.runtimeExecutable = puppeteer.executablePath();
    }

    const hideWindows = process.env['TEST_DA_HIDE_WINDOWS'] === 'true';
    if (hideWindows) {
        launchArgs.runtimeArgs = ['--headless', '--disable-gpu'];
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

/** Default setup for all our tests, using the context of the setup method
 *    - Best practise: The new best practise is to use the DefaultFixture when possible instead of calling this method directly
 */
export async function setup(context: IBeforeAndAfterContext | ITestCallbackContext, port?: number, launchProps?: ILaunchRequestArgs): Promise<ts.ExtendedDebugClient> {
    const currentTest = _.defaultTo(context.currentTest, context.test);
    return setupWithTitle(currentTest.fullTitle(), port, launchProps);
}

/** Default setup for all our tests, using the test title
 *    - Best practise: The new best practise is to use the DefaultFixture when possible instead of calling this method directly
 */
export async function setupWithTitle(testTitle: string, port?: number, launchProps?: ILaunchRequestArgs): Promise<ts.ExtendedDebugClient> {
    // killAllChromesOnWin32(); // Kill chrome.exe instances before the tests. Killing them after the tests is not as reliable. If setup fails, teardown is not executed.
    setTestLogName(testTitle);

    if (!port) {
        const daPort = process.env['TEST_DA_PORT'];
        port = daPort
            ? parseInt(daPort, 10)
            : undefined;
    }

    if (launchProps) {
        testLaunchProps = launchProps;
    }

    const debugClient = await ts.setup({ entryPoint: DEBUG_ADAPTER, type: 'chrome', patchLaunchArgs: args => patchLaunchArgs(args, testTitle), port: port });
    debugClient.defaultTimeout = DefaultTimeoutMultiplier * 10000 /*10 seconds*/;

    if(isThisV2) { // The logging proxy breaks lots of tests in v1, possibly due to some race conditions exposed by the extra delay
        const wrappedDebugClient = logCallsTo(debugClient, 'DebugAdapterClient');
        return wrappedDebugClient;
    }
    return debugClient;
}

export async function teardown() {
    await ts.teardown();
}

export function killAllChromesOnWin32() {
    if (process.platform === 'win32') {
        // We only need to kill the chrome.exe instances on the Windows agent
        // TODO: Figure out a way to remove this
        killAllChrome();
    }
}
