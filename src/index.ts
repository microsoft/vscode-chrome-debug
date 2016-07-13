/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {ChromeConnection} from './chrome/chromeConnection';
import {ChromeDebugAdapter} from './chrome/chromeDebugAdapter';
import * as Chrome from './chrome/chromeDebugProtocol';
import {ChromeDebugSession, IChromeDebugSessionOpts} from './chrome/chromeDebugSession';
import * as chromeUtils from './chrome/chromeUtils';

import {AdapterProxy} from './adapterProxy';
import {LineNumberTransformer} from './transformers/lineNumberTransformer';
import {SourceMapTransformer} from './transformers/sourceMapTransformer';

import * as utils from './utils';
import * as logger from './logger';

export {
    ChromeConnection,
    ChromeDebugAdapter,
    Chrome,
    ChromeDebugSession,
    IChromeDebugSessionOpts,
    chromeUtils,

    AdapterProxy,
    LineNumberTransformer,
    SourceMapTransformer,

    utils,
    logger
}