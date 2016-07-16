/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as fs from 'fs';
import {DebugClient} from 'vscode-debugadapter-testsupport';

const packageContents = JSON.parse(fs.readFileSync(__dirname + '/../../package.json').toString());
const debuggerConfig = packageContents.contributes.debuggers[0];

suite('E2E', () => {
    let dc: DebugClient;
    setup(() => {
        dc = new DebugClient(debuggerConfig.runtime, debuggerConfig.program, debuggerConfig.type);
        dc.on('output', output => {
            console.log('adapter: ' + output.body.output);
        });

        return dc.start();
    });

    teardown(() => {
        return dc.stop();
    });

    suite('launch', () => {
        test('basic launch and attach', function() {
            // attaching has a ~7s timeout
            this.timeout(10000);

            return dc.launch({ url: 'http://localhost:8080', userDataDir: __dirname + '/../testapp/.vscode/chrome', diagnosticLogging: true });
        });
    });
});