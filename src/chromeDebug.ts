/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {ChromeDebugSession} from 'vscode-chrome-debug-core';

// Start a ChromeDebugSession configured to only match 'page' targets, which are Chrome tabs
ChromeDebugSession.run(ChromeDebugSession.getSession(
    { targetFilter: target => target && (!target.type || target.type === 'page') }));
