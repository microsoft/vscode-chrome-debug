/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { ChromeDebugAdapter as CoreDebugAdapter } from 'vscode-chrome-debug-core';

export class ChromeDebugAdapter extends CoreDebugAdapter {
    protected threadName(): string {
        return 'Chrome';
    }
}
