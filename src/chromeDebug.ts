/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {ChromeDebugSession} from 'vscode-chrome-debug-core';
import {DebugSession} from 'vscode-debugadapter';

DebugSession.run(<typeof DebugSession><any>ChromeDebugSession);
