/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {ChromeDebugSession} from './chromeDebugSession';
import {DebugSession} from 'vscode-debugadapter';

DebugSession.run(ChromeDebugSession);
