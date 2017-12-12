/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { createServer } from 'http-server';

import * as ts from 'vscode-chrome-debug-core-testsupport';

import * as testSetup from './testSetup';

function runCommonTests(breakOnLoadStrategy: string) {
    const DATA_ROOT = testSetup.DATA_ROOT;

    let dc: ts.ExtendedDebugClient;
    setup(() => {
        return testSetup.setup(undefined, { breakOnLoadStrategy: breakOnLoadStrategy })
            .then(_dc => dc = _dc);
    });

    let server: any;
    teardown(() => {
        if (server) {
            server.close();
        }

        return testSetup.teardown();
    });

    suite('TypeScript Project with SourceMaps', () => {
        test('Hits a single breakpoint in a file on load', async () => {
            const testProjectRoot = path.join(DATA_ROOT, 'breakOnLoad_sourceMaps');
            const scriptPath = path.join(testProjectRoot, 'src/script.ts');

            server = createServer({ root: testProjectRoot });
            server.listen(7890);

            const url = 'http://localhost:7890/index.html';

            const bpLine = 3;
            const bpCol = 12;

            await dc.hitBreakpointUnverified({ url, webRoot: testProjectRoot }, { path: scriptPath, line: bpLine, column: bpCol });
        });

        test('Hits multiple breakpoints in a file on load', async () => {
            const testProjectRoot = path.join(DATA_ROOT, 'breakOnLoad_sourceMaps');
            const scriptPath = path.join(testProjectRoot, 'src/script.ts');

            server = createServer({ root: testProjectRoot });
            server.listen(7890);

            const url = 'http://localhost:7890/index.html';

            const bp1Line = 3;
            const bp1Col = 12;
            const bp2Line = 6;

            await dc.hitBreakpointUnverified({ url, webRoot: testProjectRoot }, { path: scriptPath, line: bp1Line, column: bp1Col });
            await dc.setBreakpointsRequest({ source: { path: scriptPath }, breakpoints: [{ line: bp2Line }] });
            await dc.continueTo('breakpoint', { line: bp2Line });
        });

        test('Hits a breakpoint at (1,1) in a file on load', async () => {
            const testProjectRoot = path.join(DATA_ROOT, 'breakOnLoad_sourceMaps');
            const scriptPath = path.join(testProjectRoot, 'src/script.ts');

            server = createServer({ root: testProjectRoot });
            server.listen(7890);

            const url = 'http://localhost:7890/index.html';

            const bpLine = 1;
            const bpCol = 1;

            await dc.hitBreakpointUnverified({ url, webRoot: testProjectRoot }, { path: scriptPath, line: bpLine, column: bpCol });
        });

        test('Hits a breakpoint in the first line in a file on load', async () => {
            const testProjectRoot = path.join(DATA_ROOT, 'breakOnLoad_sourceMaps');
            const scriptPath = path.join(testProjectRoot, 'src/script.ts');

            server = createServer({ root: testProjectRoot });
            server.listen(7890);

            const url = 'http://localhost:7890/index.html';

            const bpLine = 1;
            const bpCol = 35;

            await dc.hitBreakpointUnverified({ url, webRoot: testProjectRoot }, { path: scriptPath, line: bpLine, column: bpCol });
        });
    });

    suite('Simple JavaScript Project', () => {
        test('Hits a single breakpoint in a file on load', async () => {
            const testProjectRoot = path.join(DATA_ROOT, 'breakOnLoad_javaScript');
            const scriptPath = path.join(testProjectRoot, 'src/script.js');

            server = createServer({ root: testProjectRoot });
            server.listen(7890);

            const url = 'http://localhost:7890/index.html';

            const bpLine = 3;
            const bpCol = 12;

            await dc.hitBreakpointUnverified({ url, webRoot: testProjectRoot }, { path: scriptPath, line: bpLine, column: bpCol });
        });

        test('Hits multiple breakpoints in a file on load', async () => {
            const testProjectRoot = path.join(DATA_ROOT, 'breakOnLoad_javaScript');
            const scriptPath = path.join(testProjectRoot, 'src/script.js');

            server = createServer({ root: testProjectRoot });
            server.listen(7890);

            const url = 'http://localhost:7890/index.html';

            const bp1Line = 3;
            const bp1Col = 12;
            const bp2Line = 6;

            await dc.hitBreakpointUnverified({ url, webRoot: testProjectRoot }, { path: scriptPath, line: bp1Line, column: bp1Col });
            await dc.setBreakpointsRequest({ source: { path: scriptPath }, breakpoints: [{ line: bp2Line }] });
            await dc.continueTo('breakpoint', { line: bp2Line });
        });

        test('Hits a breakpoint at (1,1) in a file on load', async () => {
            const testProjectRoot = path.join(DATA_ROOT, 'breakOnLoad_javaScript');
            const scriptPath = path.join(testProjectRoot, 'src/script.js');

            server = createServer({ root: testProjectRoot });
            server.listen(7890);

            const url = 'http://localhost:7890/index.html';

            const bpLine = 1;
            const bpCol = 1;

            await dc.hitBreakpointUnverified({ url, webRoot: testProjectRoot }, { path: scriptPath, line: bpLine, column: bpCol });
        });

        test('Hits a breakpoint in the first line in a file on load', async () => {
            const testProjectRoot = path.join(DATA_ROOT, 'breakOnLoad_javaScript');
            const scriptPath = path.join(testProjectRoot, 'src/script.js');

            server = createServer({ root: testProjectRoot });
            server.listen(7890);

            const url = 'http://localhost:7890/index.html';

            const bpLine = 1;
            const bpCol = 35;

            await dc.hitBreakpointUnverified({ url, webRoot: testProjectRoot }, { path: scriptPath, line: bpLine, column: bpCol });
        });
    });
}

suite('BreakOnLoad', () => {
    const DATA_ROOT = testSetup.DATA_ROOT;

    suite('Regex Common Tests', () => {
        runCommonTests("regex");
    });

    suite('Instrument Common Tests', () => {
        runCommonTests("instrument");
    });

    suite('Instrument Webpack Project', () => {
        let dc: ts.ExtendedDebugClient;
        setup(() => {
            return testSetup.setup(undefined, { breakOnLoadStrategy: "instrument" })
                .then(_dc => dc = _dc);
        });

        let server: any;
        teardown(() => {
            if (server) {
                server.close();
            }

            return testSetup.teardown();
        });

        test('Hits a single breakpoint in a file on load', async () => {
            const testProjectRoot = path.join(DATA_ROOT, 'breakOnLoad_webpack');
            const scriptPath = path.join(testProjectRoot, 'src/script.js');

            server = createServer({ root: testProjectRoot });
            server.listen(7890);

            const url = 'http://localhost:7890/dist/index.html';

            const bpLine = 3;
            const bpCol = 1;

            await dc.hitBreakpointUnverified({ url, webRoot: testProjectRoot }, { path: scriptPath, line: bpLine , column: bpCol});
        });

        test('Hits multiple breakpoints in a file on load', async () => {
            const testProjectRoot = path.join(DATA_ROOT, 'breakOnLoad_webpack');
            const scriptPath = path.join(testProjectRoot, 'src/script.js');

            server = createServer({ root: testProjectRoot });
            server.listen(7890);

            const url = 'http://localhost:7890/dist/index.html';

            // For some reason, column numbers > don't work perfectly with webpack
            const bp1Line = 3;
            const bp1Col = 1;
            const bp2Line = 5;
            const bp2Col = 1;

            await dc.hitBreakpointUnverified({ url, webRoot: testProjectRoot }, { path: scriptPath, line: bp1Line , column: bp1Col});
            await dc.setBreakpointsRequest({ source: { path: scriptPath }, breakpoints: [{ line: bp2Line , column: bp2Col}] });
            await dc.continueTo('breakpoint', { line: bp2Line , column: bp2Col});
        });

        test('Hits a breakpoint at (1,1) in a file on load', async () => {
            const testProjectRoot = path.join(DATA_ROOT, 'breakOnLoad_webpack');
            const scriptPath = path.join(testProjectRoot, 'src/script.js');

            server = createServer({ root: testProjectRoot });
            server.listen(7890);

            const url = 'http://localhost:7890/dist/index.html';

            const bpLine = 1;
            const bpCol = 1;

            await dc.hitBreakpointUnverified({ url, webRoot: testProjectRoot }, { path: scriptPath, line: bpLine, column: bpCol });
        });
    });

    suite('BreakOnLoad Disabled (strategy: off)', () => {
        let dc: ts.ExtendedDebugClient;
        setup(() => {
            return testSetup.setup(undefined, { breakOnLoadStrategy: "off" })
                .then(_dc => dc = _dc);
        });

        let server: any;
        teardown(() => {
            if (server) {
                server.close();
            }

            return testSetup.teardown();
        });

        test('Does not hit a breakpoint in a file on load', async () => {
            const testProjectRoot = path.join(DATA_ROOT, 'breakOnLoad_sourceMaps');
            const scriptPath = path.join(testProjectRoot, 'src/script.ts');

            server = createServer({ root: testProjectRoot });
            server.listen(7890);

            const url = 'http://localhost:7890/index.html';

            // We try to put a breakpoint at (1,1). If this doesn't get hit, the console.log statement in the script should be executed
            const bpLine = 1;
            const bpCol = 1;

            return new Promise( (resolve, reject) => {
                // Add an event listener for the output event to capture the console.log statement
                dc.addListener('output', function(event) {
                    // If console.log event statement is executed, pass the test
                    if (event.body.category === 'stdout' && event.body.output === 'Hi\n') {
                        resolve();
                    }
                }),
                Promise.all([
                    dc.waitForEvent('initialized').then(event => {
                        return dc.setBreakpointsRequest({
                            lines: [bpLine],
                            breakpoints: [{ line: bpLine, column: bpCol }],
                            source: { path: scriptPath }
                        });
                    }).then(response => {
                        return dc.configurationDoneRequest();
                    }),

                    dc.launch({ url: 'http://localhost:7890/index.html', webRoot: testProjectRoot })
                ]);
            });
        });
    });
});
