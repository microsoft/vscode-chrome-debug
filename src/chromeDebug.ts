/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {ChromeDebugSession, logger, UrlPathTransformer, BaseSourceMapTransformer} from 'vscode-chrome-debug-core';
import * as path from 'path';

import {ChromeDebugAdapter} from './chromeDebugAdapter';

const EXTENSION_NAME = 'debugger-for-chrome';
const targetFilter = target => target && (!target.type || target.type === 'page');

// Start a ChromeDebugSession configured to only match 'page' targets, which are Chrome tabs.
// Cast because DebugSession is declared twice - in this repo's vscode-debugadapter, and that of -core... TODO
ChromeDebugSession.run(ChromeDebugSession.getSession(
    {
        adapter: ChromeDebugAdapter,
        extensionName: EXTENSION_NAME,
        logFilePath: path.resolve(__dirname, '../../vscode-chrome-debug.txt'), // non-.txt file types can't be uploaded to github
        targetFilter,

        pathTransformer: UrlPathTransformer,
        sourceMapTransformer: BaseSourceMapTransformer,
    }));

/* tslint:disable:no-var-requires */
logger.log(EXTENSION_NAME + ': ' + require('../../package.json').version);
/* tslint:enable:no-var-requires */
