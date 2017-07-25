/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {ChromeDebugSession, logger, UrlPathTransformer, BaseSourceMapTransformer} from 'vscode-chrome-debug-core';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import {targetFilter} from './utils';

import {ChromeDebugAdapter} from './chromeDebugAdapter';

const EXTENSION_NAME = 'debugger-for-chrome';

// Injected by webpack
declare let VERSION: string;
let versionWithDefault = typeof VERSION === 'undefined' ? 'unspecified' : VERSION; // Not built with webpack for tests

// non-.txt file types can't be uploaded to github. Generated filename is something like: vscode-chrome-debug_2017-07-19_161210.txt
const timestampForFilename = new Date().toISOString().replace(/T/, '_').replace(/:/g, '').replace(/\..*/, '');
const logFilePath = path.join(os.tmpdir(), `vscode-chrome-debug_${timestampForFilename}.txt`)


// Start a ChromeDebugSession configured to only match 'page' targets, which are Chrome tabs.
// Cast because DebugSession is declared twice - in this repo's vscode-debugadapter, and that of -core... TODO
ChromeDebugSession.run(ChromeDebugSession.getSession(
    {
        adapter: ChromeDebugAdapter,
        extensionName: EXTENSION_NAME,
        logFilePath,
        targetFilter,

        pathTransformer: UrlPathTransformer,
        sourceMapTransformer: BaseSourceMapTransformer,
    }));

logger.log(EXTENSION_NAME + ': ' + versionWithDefault);
