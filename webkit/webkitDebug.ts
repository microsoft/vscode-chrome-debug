/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {WebKitDebugSession} from './webKitDebugSession';
import {DebugSession} from 'vscode-debugadapter';

DebugSession.run(WebKitDebugSession);
