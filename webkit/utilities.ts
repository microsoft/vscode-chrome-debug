/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import os = require('os');
import fs = require('fs');

export function getBrowserPath(): string {
    const platform = os.platform();
    if (platform === 'darwin') {
        return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    } else if (platform === 'win32') {
        const pfx86ChromePath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
        const pfChromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
        if (existsSync(pfx86ChromePath)) {
            return pfx86ChromePath;
        } else if (existsSync(pfChromePath)) {
            return pfChromePath;
        } else {
            // TODO not installed, fail
        }
    } else {
        return '/usr/bin/google-chrome';
    }
}

function existsSync(path: string): boolean {
    try {
        fs.statSync(path);
    } catch (e) {
        // doesn't exist
        return false;
    }

    return true;
}

export class DebounceHelper {
    private waitToken: NodeJS.Timer;

    constructor(private timeoutMs: number) { }

    public wait(fn: () => any): void {
        if (!this.waitToken) {
            this.waitToken = setTimeout(() => {
                this.waitToken = null;
                fn();
            }, this.timeoutMs)
        }
    }

    public doAndCancel(fn: () => any): void {
        if (this.waitToken) {
            clearTimeout(this.waitToken);
            this.waitToken = null;
        }

        fn();
    }
}