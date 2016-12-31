/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as path from 'path';
import * as tmp from 'tmp';

import {DebugProtocol} from 'vscode-debugprotocol';
import {DebugClient} from 'vscode-debugadapter-testsupport';

// ES6 default export...
const LoggingReporter = require('./loggingReporter');

const DEBUG_ADAPTER = './out/src/chromeDebug.js';

let dc: DebugClient;

let unhandledAdapterErrors: string[];
const origTest = test;
const checkLogTest = (title: string, testCallback?: any, testFn: Function = origTest): Mocha.ITest => {
    // Hack to always check logs after a test runs, can simplify after this issue:
    // https://github.com/mochajs/mocha/issues/1635
    if (!testCallback) {
        return origTest(title, testCallback);
    }

    function runTest(): Promise<any> {
        return new Promise((resolve, reject) => {
            const optionalCallback = e => {
                if (e) reject(e)
                else resolve();
            };

            const maybeP = testCallback(optionalCallback);
            if (maybeP && maybeP.then) {
                maybeP.then(resolve, reject);
            }
        });
    }

    return testFn(title, () => {
        return runTest()
            .then(() => {
                // If any unhandled errors were logged, then ensure the test fails
                if (unhandledAdapterErrors.length) {
                    const errStr = unhandledAdapterErrors.length === 1 ? unhandledAdapterErrors[0] :
                        JSON.stringify(unhandledAdapterErrors);
                    throw new Error(errStr);
                }
            });
    });
};
(<Mocha.ITestDefinition>checkLogTest).only = (expectation, assertion) => checkLogTest(expectation, assertion, origTest.only);
(<Mocha.ITestDefinition>checkLogTest).skip = test.skip;
test = (<any>checkLogTest);

function log(e: DebugProtocol.OutputEvent) {
    // Skip telemetry events
    if (e.body.category === 'telemetry') return;

    const timestamp = new Date().toISOString().split(/[TZ]/)[1];
    const outputBody = e.body.output ? e.body.output.trim() : 'variablesReference: ' + e.body.variablesReference;
    const msg = ` ${timestamp} ${outputBody}`;
    LoggingReporter.logEE.emit('log', msg);

    if (msg.indexOf('********') >= 0) unhandledAdapterErrors.push(msg);
};

function patchLaunchArgFns(): void {
    function patchLaunchArgs(launchArgs) {
        launchArgs.verboseDiagnosticLogging = true;
        const tmpDir = tmp.dirSync({ prefix: 'chrome-' });
        launchArgs.userDataDir = tmpDir.name;
    }

    const origLaunch = dc.launch;
    dc.launch = (launchArgs: any) => {
        patchLaunchArgs(launchArgs);
        return origLaunch.call(dc, launchArgs);
    };

    const origHitBreakpoint = dc.hitBreakpoint;
    dc.hitBreakpoint = (...args) => {
        const launchArgs = args[0];
        patchLaunchArgs(launchArgs);
        return origHitBreakpoint.apply(dc, args);
    };
}

export const lowercaseDriveLetterDirname = __dirname.charAt(0).toLowerCase() + __dirname.substr(1);
export const PROJECT_ROOT = path.join(lowercaseDriveLetterDirname, '../../../');
export const DATA_ROOT = path.join(PROJECT_ROOT, 'testdata/');

export function setup(port?: number) {
    unhandledAdapterErrors = [];
    dc = new DebugClient('node', DEBUG_ADAPTER, 'chrome');
    patchLaunchArgFns();
    dc.addListener('output', log);

    return dc.start(port)
        .then(() => dc);
}

export function teardown() {
    dc.removeListener('output', log);
    return dc.stop();
}
