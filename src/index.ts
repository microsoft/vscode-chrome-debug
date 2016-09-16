/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {ChromeConnection} from './chrome/chromeConnection';
import {ChromeDebugAdapter} from './chrome/chromeDebugAdapter';
import {ChromeDebugSession, IChromeDebugSessionOpts} from './chrome/chromeDebugSession';
import * as chromeTargetDiscoveryStrategy from './chrome/chromeTargetDiscoveryStrategy';
import * as chromeUtils from './chrome/chromeUtils';

import {BasePathTransformer} from './transformers/basePathTransformer';
import {UrlPathTransformer} from './transformers/urlPathTransformer';
import {LineNumberTransformer} from './transformers/lineNumberTransformer';
import {BaseSourceMapTransformer} from './transformers/baseSourceMapTransformer';

export * from './debugAdapterInterfaces';

import * as utils from './utils';
import * as logger from './logger';

import * as testUtils from '../test/testUtils';

export {
    ChromeConnection,
    ChromeDebugAdapter,
    ChromeDebugSession,
    IChromeDebugSessionOpts,
    chromeTargetDiscoveryStrategy,
    chromeUtils,

    UrlPathTransformer,
    BasePathTransformer,
    LineNumberTransformer,
    BaseSourceMapTransformer,

    utils,
    logger,

    testUtils
}
