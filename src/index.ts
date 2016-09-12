/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {ChromeConnection} from './chrome/chromeConnection';
import {ChromeDebugAdapter} from './chrome/chromeDebugAdapter';
import {ChromeDebugSession, IChromeDebugSessionOpts} from './chrome/chromeDebugSession';
import * as chromeTargetDiscoveryStrategy from './chrome/chromeTargetDiscoveryStrategy';
import * as chromeUtils from './chrome/chromeUtils';

import {BasePathTransformer} from './transformers/basePathTransformer';
import {PathTransformer} from './transformers/pathTransformer';
import {LineNumberTransformer} from './transformers/lineNumberTransformer';
import {LazySourceMapTransformer} from './transformers/lazySourceMapTransformer';

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

    PathTransformer,
    BasePathTransformer,
    LineNumberTransformer,
    LazySourceMapTransformer,

    utils,
    logger,

    testUtils
}
