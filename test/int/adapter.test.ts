/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as path from 'path';
const {createServer} = require('http-server');

import {DebugClient} from 'vscode-debugadapter-testsupport';

import * as testUtils from './intTestUtils';
import * as testSetup from './testSetup';

const DATA_ROOT = testSetup.DATA_ROOT;

suite('Chrome Debug Adapter etc', () => {
    let dc: DebugClient;
    setup(() => {
        return testSetup.setup()
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
                dc.assertStoppedLocation('debugger statement', { path: breakFile, line: DEBUGGER_LINE } )
            ]);
        });

        test('should stop on debugger statement in http://localhost', () => {
            const testProjectRoot = path.join(DATA_ROOT, 'intervalDebugger');
            const breakFile = path.join(testProjectRoot, 'src/app.ts');
            const DEBUGGER_LINE = 2;

            const server = createServer({ root: testProjectRoot });
            server.listen(7890);

            return Promise.all([
                dc.configurationSequence(),
                dc.launch({ url: 'http://localhost:7890', webRoot: testProjectRoot }),
                dc.assertStoppedLocation('debugger statement', { path: breakFile, line: DEBUGGER_LINE } )
            ])
            .then(
                () => server.close(),
                e => {
                    server.close();
                    throw e;
                });
        });
    });
});