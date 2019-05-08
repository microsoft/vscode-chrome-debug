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
import { IAttachRequestArgs } from '../../../vscode-chrome-debug-core/lib/src/debugAdapterInterfaces';
import { execSync } from 'child_process';
import { expect } from 'chai';
import { killAllChrome } from '../testUtils';

const DATA_ROOT = testSetup.DATA_ROOT;

suite('Chrome Debug Adapter etc', () => {
    let dc: ExtendedDebugClient;
    let server: HttpOrHttpsServer | null;

    setup(function () {
        return testSetup.setup(this)
            .then(_dc => dc = _dc);
    });

    teardown(() => {
        if (server) {
            server.close(err => console.log('Error closing server in teardown: ' + (err && err.message)));
            server = null;
        }

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
        /**
         * On MacOS it fails because: stopped location: path mismatch‌:
         *   ‌+ expected‌: ‌/users/vsts/agent/2.150.0/work/1/s/testdata/intervaldebugger/out/app.js‌
         *   - actual‌:    users/vsts/agent/2.150.0/work/1/s/testdata/intervaldebugger/out/app.js‌
         */
        (isWindows ? test : test.skip)('should stop on debugger statement in file:///, sourcemaps disabled', () => {
            const testProjectRoot = path.join(DATA_ROOT, 'intervalDebugger');
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
            const testProjectRoot = path.join(DATA_ROOT, 'intervalDebugger');
            const breakFile = path.join(testProjectRoot, 'src/app.ts');
            const DEBUGGER_LINE = 2;

            server = createServer({ root: testProjectRoot });
            server.listen(7890);

            return Promise.all([
                dc.configurationSequence(),
                dc.launch({ url: 'http://localhost:7890', webRoot: testProjectRoot }),
                dc.assertStoppedLocation('debugger_statement', { path: breakFile, line: DEBUGGER_LINE } )
            ]);
        });

        test('Should attach to existing instance of chrome and break on debugger statement', async () => {
            const testProjectRoot = path.join(DATA_ROOT, 'intervalDebugger');
            const breakFile = path.join(testProjectRoot, 'src/app.ts');
            const DEBUGGER_LINE = 2;

            server = createServer({ root: testProjectRoot });
            server.listen(7890);
            const browser = await puppeteer.launch(<puppeteer.LaunchOptions>{ headless: false, args: ['http://localhost:7890', '--remote-debugging-port=7777'] });

            await Promise.all([
                dc.configurationSequence(),
                dc.initializeRequest().then(_ => {
                    return dc.attachRequest(<IAttachRequestArgs>{ url: 'http://localhost:7890', port: 7777, webRoot: testProjectRoot });
                }),
                dc.assertStoppedLocation('debugger_statement', { path: breakFile, line: DEBUGGER_LINE } )
            ]);

            await browser.close();
        });

        test('Should throw error when launching if chrome debug port is in use', async () => {

            const testProjectRoot = path.join(DATA_ROOT, 'intervalDebugger');

            server = createServer({ root: testProjectRoot });
            server.listen(7890);

            // browser already launched to the default port, and navigated away from about:blank
            const browser = await puppeteer.launch(<puppeteer.LaunchOptions>{ headless: false, args: ['http://localhost:7890', '--remote-debugging-port=9222'] });
            try {
                await Promise.all([
                    dc.configurationSequence(),
                    dc.launch({ url: 'http://localhost:7890', timeout: 2000, webRoot: testProjectRoot }),
                ]);
            } catch (err) {
                expect(err.message).to.satisfy( (x: string) => x.startsWith('Cannot connect to runtime process, timeout after 2000 ms'));
            }

            await browser.close();

            // force kill chrome here, as it will be left open by the debug adapter (same behavior as v1)
            killAllChrome();
        });
    });
});