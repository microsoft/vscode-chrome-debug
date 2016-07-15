/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {ChromeConnection} from './chrome/chromeConnection';
import {ChromeDebugAdapter} from './chrome/chromeDebugAdapter';
import {ChromeDebugSession, IChromeDebugSessionOpts} from './chrome/chromeDebugSession';
import * as chromeTargetDiscoveryStrategy from './chrome/chromeTargetDiscoveryStrategy';
import * as chromeUtils from './chrome/chromeUtils';

import {AdapterProxy} from './adapterProxy';
import {LineNumberTransformer} from './transformers/lineNumberTransformer';
import {SourceMapTransformer} from './transformers/sourceMapTransformer';

export * from './debugAdapterInterfaces';

import * as utils from './utils';
import * as logger from './logger';

export {
    ChromeConnection,
    ChromeDebugAdapter,
    ChromeDebugSession,
    IChromeDebugSessionOpts,
    chromeTargetDiscoveryStrategy,
    chromeUtils,

    AdapterProxy,
    LineNumberTransformer,
    SourceMapTransformer,

    utils,
    logger
}
