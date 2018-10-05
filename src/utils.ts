/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as path from 'path';
import { utils as coreUtils, chromeConnection } from 'vscode-chrome-debug-core';

const WIN_APPDATA = process.env.LOCALAPPDATA || '/';
const CHROME_LAUNCH_COMMANDS = {
    LINUX: ['/usr/bin/google-chrome'],
    OSX: ['open', '-a', 'google chrome', '--args'],
    WIN: ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'],
    WIN_LOCALAPPDATA: [path.join(WIN_APPDATA, 'Google\\Chrome\\Application\\chrome.exe')],
    WINx86: ['C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'],
};

export function getBrowserLaunchCommand(): string[] {
    const platform = coreUtils.getPlatform();
    if (platform === coreUtils.Platform.OSX) {
        return CHROME_LAUNCH_COMMANDS.OSX;
    } else if (platform === coreUtils.Platform.Windows) {
        if (coreUtils.existsSync(CHROME_LAUNCH_COMMANDS.WINx86[0])) {
            return CHROME_LAUNCH_COMMANDS.WINx86;
        } else if (coreUtils.existsSync(CHROME_LAUNCH_COMMANDS.WIN[0])) {
            return CHROME_LAUNCH_COMMANDS.WIN;
        } else if (coreUtils.existsSync(CHROME_LAUNCH_COMMANDS.WIN_LOCALAPPDATA[0])) {
            return CHROME_LAUNCH_COMMANDS.WIN_LOCALAPPDATA;
        } else {
            return null;
        }
    } else {
        return CHROME_LAUNCH_COMMANDS.LINUX;
    }
}

export class DebounceHelper {
    private waitToken: any; // TS can't decide whether Timer or number...

    constructor(private timeoutMs: number) { }

    /**
     * If not waiting already, call fn after the timeout
     */
    public wait(fn: () => any): void {
        if (!this.waitToken) {
            this.waitToken = setTimeout(() => {
                this.waitToken = null;
                fn();
            },
                this.timeoutMs);
        }
    }

    /**
     * If waiting for something, cancel it and call fn immediately
     */
    public doAndCancel(fn: () => any): void {
        if (this.waitToken) {
            clearTimeout(this.waitToken);
            this.waitToken = null;
        }

        fn();
    }
}

export const getTargetFilter = (targetTypes?: string[]): chromeConnection.ITargetFilter => {
    if (targetTypes) {
        return target => target && (!target.type || targetTypes.indexOf(target.type) !== -1);
    }

    return () => true;
};

export const defaultTargetFilter = getTargetFilter(['page']);
