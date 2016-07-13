/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {ChromeConnection} from './chrome/chromeConnection';
import {ChromeDebugAdapter} from './chrome/chromeDebugAdapter';
import * as Chrome from './chrome/chromeDebugProtocol';
import {ChromeDebugSession, IChromeDebugSessionOpts} from './chrome/chromeDebugSession';
import * as chromeTargetDiscoveryStrategy from './chrome/chromeTargetDiscoveryStrategy';
import * as chromeUtils from './chrome/chromeUtils';

import * as debugAdapterInterfaces from './debugAdapterInterfaces';
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
    chromeTargetDiscoveryStrategy,
    chromeUtils,

    debugAdapterInterfaces,
    AdapterProxy,
    LineNumberTransformer,
    SourceMapTransformer,

    utils,
    logger
}