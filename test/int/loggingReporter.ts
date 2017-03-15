/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mocha from 'mocha';
import * as events from 'events';

class LoggingReporter extends mocha.reporters.Spec {
    static logEE = new events.EventEmitter();

    private testLogs: string[];
    private inTest = false;

    constructor(runner: any) {
        super(runner);

        LoggingReporter.logEE.on('log', msg => {
            if (this.inTest) {
                this.testLogs.push(msg);
            }
        });

        runner.on('test', test => {
            this.inTest = true;
            this.testLogs = [];
        });

        runner.on('pass', test => {
            this.inTest = false;
        });

        runner.on('fail', test => {
            this.inTest = false;
            this.testLogs.forEach(msg => {
                console.log(msg);
            });

            console.log(new Date().toISOString().split(/[TZ]/)[1] + ' Finished');
        });
    }
}

export = LoggingReporter;
