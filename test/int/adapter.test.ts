/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as path from 'path';
import { createServer, } from 'http-server';

import { ExtendedDebugClient } from 'vscode-chrome-debug-core-testsupport';

import * as testSetup from './testSetup';
import { HttpOrHttpsServer } from './types/server';
import { isWindows } from './testSetup';
import * as puppeteer from 'puppeteer';
import { expect } from 'chai';
import { killAllChrome } from '../testUtils';
import { IAttachRequestArgs } from 'vscode-chrome-debug-core';
import { getDebugAdapterLogFilePath } from './utils/logging';

const DATA_ROOT = testSetup.DATA_ROOT;

suite('Chrome Debug Adapter etc', () => {
    let dc: ExtendedDebugClient;
    let server: HttpOrHttpsServer | null;

    setup(function () {
        return testSetup.setup(this)
            .then(_dc => dc = _dc);
    });

    teardown(() => {
        return testSetup.teardown();
    });

    suite('basic', () => {
        test('unknown request should produce error', done => {
            dc.send('illegal_request').then(() => {
                done(new Error('does not report error on unknown request'));
            }).catch(() => {
                done();
            });
        });
    });

    suite('initialize', () => {
        test('should return supported features', () => {
            return dc.initializeRequest().then(response => {
                assert.notEqual(response.body, undefined);
                assert.equal(response.body!.supportsConfigurationDoneRequest, true);
            });
        });
    });

    suite('launch', () => {
        const testProjectRoot = path.join(DATA_ROOT, 'intervalDebugger');
        setup(() => {

            server = createServer({ root: testProjectRoot });
            server.listen(7890);
        });

        teardown(() => {
            if (server) {
                server.close(err => console.log('Error closing server in teardown: ' + (err && err.message)));
                server = null;
            }
        });

        /**
         * On MacOS it fails because: stopped location: path mismatch‌:
         *   ‌+ expected‌: ‌/users/vsts/agent/2.150.0/work/1/s/testdata/intervaldebugger/out/app.js‌
         *   - actual‌:    users/vsts/agent/2.150.0/work/1/s/testdata/intervaldebugger/out/app.js‌
         */
        (isWindows ? test : test.skip)('should stop on debugger statement in file:///, sourcemaps disabled', () => {

            const launchFile = path.join(testProjectRoot, 'index.html');
            const breakFile = path.join(testProjectRoot, 'out/app.js');
            const DEBUGGER_LINE = 2;

            return Promise.all([
                dc.configurationSequence(),
                dc.launch({ file: launchFile, sourceMaps: false }),
                dc.assertStoppedLocation('debugger_statement', { path: breakFile, line: DEBUGGER_LINE } )
            ]);
        });

        test('should stop on debugger statement in http://localhost', () => {
            const breakFile = path.join(testProjectRoot, 'src/app.ts');
            const DEBUGGER_LINE = 2;

            return Promise.all([
                dc.configurationSequence(),
                dc.launch({ url: 'http://localhost:7890', webRoot: testProjectRoot }),
                dc.assertStoppedLocation('debugger_statement', { path: breakFile, line: DEBUGGER_LINE } )
            ]);
        });

        const testTitle = 'Should attach to existing instance of chrome and break on debugger statement';
        test(testTitle, async () => {
            const fullTestTitle = `Chrome Debug Adapter etc launch ${testTitle}`;
            const breakFile = path.join(testProjectRoot, 'src/app.ts');
            const DEBUGGER_LINE = 2;
            const remoteDebuggingPort = 7777;

            const browser = await puppeteer.launch({ headless: false, args: ['http://localhost:7890', `--remote-debugging-port=${remoteDebuggingPort}`] });
            try {
                await Promise.all([
                    dc.configurationSequence(),
                    dc.initializeRequest().then(_ => {
                        return dc.attachRequest(<IAttachRequestArgs>{
                            url: 'http://localhost:7890', port: remoteDebuggingPort, webRoot: testProjectRoot,
                            logFilePath: getDebugAdapterLogFilePath(fullTestTitle), logTimestamps: true
                        });
                    }),
                    dc.assertStoppedLocation('debugger_statement', { path: breakFile, line: DEBUGGER_LINE } )
                ]);
            }
            finally {
                await browser.close();
            }
        });

        test('Should hit breakpoint even if webRoot has unexpected case all lowercase for VisualStudio', async () => {
            const breakFile = path.join(testProjectRoot, 'src/app.ts');
            const DEBUGGER_LINE = 2;

            await dc.initializeRequest({
                adapterID: 'chrome',
                clientID: 'visualstudio',
                linesStartAt1: true,
                columnsStartAt1: true,
                pathFormat: 'path'
            });

            await dc.launchRequest( { url: 'http://localhost:7890', webRoot: testProjectRoot.toLowerCase(), runtimeExecutable: puppeteer.executablePath() } as any);
            await dc.setBreakpointsRequest({ source: { path: breakFile }, breakpoints: [{ line: DEBUGGER_LINE }] });
            await dc.configurationDoneRequest();
            await dc.assertStoppedLocation('debugger_statement', { path: breakFile, line: DEBUGGER_LINE } );
        });

        test('Should hit breakpoint even if webRoot has unexpected case all uppercase for VisualStudio', async () => {
            const breakFile = path.join(testProjectRoot, 'src/app.ts');
            const DEBUGGER_LINE = 2;

            await dc.initializeRequest({
                adapterID: 'chrome',
                clientID: 'visualstudio',
                linesStartAt1: true,
                columnsStartAt1: true,
                pathFormat: 'path'
            });
            await dc.launchRequest({ url: 'http://localhost:7890', webRoot: testProjectRoot.toUpperCase(), runtimeExecutable: puppeteer.executablePath() } as any);
            await dc.setBreakpointsRequest({ source: { path: breakFile }, breakpoints: [{ line: DEBUGGER_LINE }] });
            await dc.configurationDoneRequest();
            await dc.assertStoppedLocation('debugger_statement', { path: breakFile, line: DEBUGGER_LINE } );

        });

        /**
         * This test is baselining behvaior from V1 around what happens when the adapter tries to launch when
         * there is another running instance of chrome with --remote-debugging-port set to the same port the adapter is trying to use.
         * We expect the debug adapter to throw an exception saying that the connection attempt timed out after N milliseconds.
         * TODO: We don't think is is ideal behavior for the adapter, and want to change it fairly quickly after V2 is ready to launch.
         *   right now this test exists only to verify that we match the behavior of V1
         */
        test('Should throw error when launching if chrome debug port is in use', async () => {
            // browser already launched to the default port, and navigated away from about:blank
            const remoteDebuggingPort = 9222;
            const browser = await puppeteer.launch({ headless: false, args: ['http://localhost:7890', `--remote-debugging-port=${remoteDebuggingPort}`] });

            try {
                await Promise.all([
                    dc.configurationSequence(),
                    dc.launch({ url: 'http://localhost:7890', timeout: 2000, webRoot: testProjectRoot, port: remoteDebuggingPort }),
                ]);
                assert.fail('Expected launch to throw a timeout exception, but it didn\'t.');
            } catch (err) {
                expect(err.message).to.satisfy( (x: string) => x.startsWith('Cannot connect to runtime process, timeout after 2000 ms'));
            }
            finally {
                await browser.close();
            }

            // force kill chrome here, as it will be left open by the debug adapter (same behavior as v1)
            killAllChrome();
        });
    });
});