/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as path from 'path';
import { createServer } from 'http-server';

import { ExtendedDebugClient } from 'vscode-chrome-debug-core-testsupport';

import * as testSetup from './testSetup';

const DATA_ROOT = testSetup.DATA_ROOT;

suite('Chrome Debug Adapter etc', () => {
    let dc: ExtendedDebugClient;
    let server;

    setup(() => {
        return testSetup.setup()
            .then(_dc => dc = _dc);
    });

    teardown(() => {
        if (server) {
            server.close();
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
                assert.equal(response.body.supportsConfigurationDoneRequest, true);
            });
        });
    });

    suite('launch', () => {
        test('should stop on debugger statement in file:///, sourcemaps disabled', () => {
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

        test('Should hit breakpoint even if webRoot has unexpected case all uppercase for VisualStudio', async () => {
            const testProjectRoot = path.join(DATA_ROOT, 'breakOnLoad_javaScript');
            const breakFile = path.join(testProjectRoot, 'src/script.js');
            const DEBUGGER_LINE = 3;

            const server = createServer({ root: testProjectRoot });
            try {
                server.listen(7890);
                await dc.initializeRequest({
                    adapterID: 'chrome',
                    clientID: 'visualstudio',
                    linesStartAt1: true,
                    columnsStartAt1: true,
                    pathFormat: 'path'
                });
                await dc.launchRequest({ url: 'http://localhost:7890', webRoot: testProjectRoot.toUpperCase() } as any);
                await dc.setBreakpointsRequest({ source: { path: breakFile }, breakpoints: [{ line: DEBUGGER_LINE }] });
                await dc.configurationDoneRequest();
                await dc.assertStoppedLocation('breakpoint', { path: breakFile, line: DEBUGGER_LINE } );
            } finally {
                server.close();
            }
        });

        test('Should hit breakpoint even if webRoot has unexpected case all lowercase for VisualStudio', async () => {
            const testProjectRoot = path.join(DATA_ROOT, 'breakOnLoad_javaScript');
            const breakFile = path.join(testProjectRoot, 'src/script.js');
            const DEBUGGER_LINE = 3;

            const server = createServer({ root: testProjectRoot });
            try {
                server.listen(7890);
                await dc.initializeRequest({
                    adapterID: 'chrome',
                    clientID: 'visualstudio',
                    linesStartAt1: true,
                    columnsStartAt1: true,
                    pathFormat: 'path'
                });
                await dc.launchRequest({ url: 'http://localhost:7890', webRoot: testProjectRoot.toLowerCase() } as any);
                await dc.setBreakpointsRequest({ source: { path: breakFile }, breakpoints: [{ line: DEBUGGER_LINE }] });
                await dc.configurationDoneRequest();
                await dc.assertStoppedLocation('breakpoint', { path: breakFile, line: DEBUGGER_LINE } );
            } finally {
                server.close();
            }
        });
    });
});