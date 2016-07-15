/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {ChromeDebugSession, logger} from 'vscode-chrome-debug-core';
import * as path from 'path';

// Start a ChromeDebugSession configured to only match 'page' targets, which are Chrome tabs
ChromeDebugSession.run(ChromeDebugSession.getSession(
    {
        targetFilter: target => target && (!target.type || target.type === 'page'),
        logFilePath: path.resolve(__dirname, '../../vscode-chrome-debug.txt') // non-.txt file types can't be uploaded to github
    }));

/* tslint:disable:no-var-requires */
logger.log('debugger-for-chrome: ' + require('../../package.json').version);