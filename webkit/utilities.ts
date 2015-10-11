/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import os = require('os');

export function getBrowserPath(): string {
    const platform = os.platform();
    if (platform === 'darwin') {
        return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    } else if (platform === 'win32') {
        return os.arch() === 'x64' ?
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' :
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    } else {
        return '/usr/bin/google-chrome';
    }
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