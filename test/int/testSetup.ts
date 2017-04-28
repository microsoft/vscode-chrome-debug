/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as path from 'path';
import * as tmp from 'tmp';

import * as ts from 'vscode-chrome-debug-core-testsupport';
import {DebugProtocol} from 'vscode-debugprotocol';
import {DebugClient} from 'vscode-debugadapter-testsupport';

const DEBUG_ADAPTER = './out/src/chromeDebug.js';

function patchLaunchArgs(launchArgs: any): void {
    launchArgs.trace = 'verbose';
    launchArgs.disableNetworkCache = true;

    // Start with a clean userDataDir for each test run
    const tmpDir = tmp.dirSync({ prefix: 'chrome2-' });
    launchArgs.userDataDir = tmpDir.name;
}

export const lowercaseDriveLetterDirname = __dirname.charAt(0).toLowerCase() + __dirname.substr(1);
export const PROJECT_ROOT = path.join(lowercaseDriveLetterDirname, '../../../');
export const DATA_ROOT = path.join(PROJECT_ROOT, 'testdata/');

export function setup(port?: number) {
    return ts.setup(DEBUG_ADAPTER, 'chrome', patchLaunchArgs, port);
}

export function teardown() {
    return ts.teardown();
}
