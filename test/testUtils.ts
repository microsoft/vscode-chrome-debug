/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as path from 'path';
import * as mockery from 'mockery';
import { execSync } from 'child_process';
import * as puppeteer from 'puppeteer';

export function setupUnhandledRejectionListener(): void {
    process.addListener('unhandledRejection', unhandledRejectionListener);
}

export function removeUnhandledRejectionListener(): void {
    process.removeListener('unhandledRejection', unhandledRejectionListener);
}

function unhandledRejectionListener(reason: any, _p: Promise<any>) {
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

export function registerLocMocks(): void {
    mockery.registerMock('vscode-nls', {
        config: () => () => dummyLocalize,
        loadMessageBundle: () => dummyLocalize
    });
}

/**
 * Kills all running instances of chrome (that were launched by the tests, on Windows at least) on the test host
 */
export function killAllChrome() {
    try {
        const killCmd = (process.platform === 'win32') ? `start powershell -WindowStyle hidden -Command "Get-Process | Where-Object {$_.Path -like '*${puppeteer.executablePath()}*'} | Stop-Process"` : 'killall chrome';
        const hideWindows = process.env['TEST_DA_HIDE_WINDOWS'] === 'true';
        const output = execSync(killCmd, { windowsHide: hideWindows }); // TODO: windowsHide paramenter doesn't currently work. It might be related to this: https://github.com/nodejs/node/issues/21825
        if (output.length > 0) { // Don't print empty lines
            console.log(output.toString());
        }
    } catch (e) {
        console.error(`Error killing chrome: ${e.message}`);
    }
    // the kill command will exit with a non-zero code (and cause execSync to throw) if chrome is already stopped
}

function dummyLocalize(_id: string, englishString: string): string {
    return englishString;
}
