/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {ChromeDebugSession, logger, ChromeConnection} from 'vscode-chrome-debug-core';
import * as path from 'path';

import {ChromeDebugAdapter} from './chromeDebugAdapter';

// Start a ChromeDebugSession configured to only match 'page' targets, which are Chrome tabs.
// Cast because DebugSession is declared twice - in this repo's vscode-debugadapter, and that of -core... TODO
ChromeDebugSession.run(<any>ChromeDebugSession.getSession(
    {
        logFilePath: path.resolve(__dirname, '../../vscode-chrome-debug.txt'), // non-.txt file types can't be uploaded to github
        adapter: new ChromeDebugAdapter(new ChromeConnection(undefined, target => target && (!target.type || target.type === 'page')))
    }));

/* tslint:disable:no-var-requires */
logger.log('debugger-for-chrome: ' + require('../../package.json').version);