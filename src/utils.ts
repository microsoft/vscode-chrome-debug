/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as path from 'path';
import {utils as coreUtils, chromeConnection} from 'vscode-chrome-debug-core';

const WIN_APPDATA = process.env.LOCALAPPDATA || '/';
const WIN_PROGFILES = process.env.ProgramFiles || '/';
const WIN_PROGFILESx86 = process.env['ProgramFiles(x86)'] || '/';

const WIN_DEV_LOC = 'Google\\Chrome Dev\\Application\\chrome.exe';
const WIN_BETA_LOC = 'Google\\Chrome Beta\\Application\\chrome.exe';
const WIN_STABLE_LOC = 'Google\\Chrome\\Application\\chrome.exe';

const DEFAULT_CHROME_PATH = {
    LINUX: '/usr/bin/google-chrome',
    OSX: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',

    WIN_LOCALAPPDATA_DEV: path.join(WIN_APPDATA, WIN_DEV_LOC),
    WIN_LOCALAPPDATA_BETA: path.join(WIN_APPDATA, WIN_BETA_LOC),
    WIN_LOCALAPPDATA_STABLE: path.join(WIN_APPDATA, WIN_STABLE_LOC),

    WIN_DEV: path.join(WIN_PROGFILES, WIN_DEV_LOC),
    WIN_BETA: path.join(WIN_PROGFILES, WIN_BETA_LOC),
    WIN_STABLE: path.join(WIN_PROGFILES, WIN_STABLE_LOC),

    WINx86_DEV: path.join(WIN_PROGFILESx86, WIN_DEV_LOC),
    WINx86_BETA: path.join(WIN_PROGFILESx86, WIN_BETA_LOC),
    WINx86_STABLE: path.join(WIN_PROGFILESx86, WIN_STABLE_LOC),
};

export function getBrowserPath(): string {
    const platform = coreUtils.getPlatform();
    if (platform === coreUtils.Platform.OSX) {
        return coreUtils.existsSync(DEFAULT_CHROME_PATH.OSX) ? DEFAULT_CHROME_PATH.OSX : null;
    } else if (platform === coreUtils.Platform.Windows) {
        if (coreUtils.existsSync(DEFAULT_CHROME_PATH.WIN_LOCALAPPDATA_DEV)) {
            return DEFAULT_CHROME_PATH.WIN_LOCALAPPDATA_DEV;
        } else if (coreUtils.existsSync(DEFAULT_CHROME_PATH.WIN_LOCALAPPDATA_BETA)) {
            return DEFAULT_CHROME_PATH.WIN_LOCALAPPDATA_BETA;
        } else if (coreUtils.existsSync(DEFAULT_CHROME_PATH.WIN_LOCALAPPDATA_STABLE)) {
            return DEFAULT_CHROME_PATH.WIN_LOCALAPPDATA_STABLE;
        } else if (coreUtils.existsSync(DEFAULT_CHROME_PATH.WIN_DEV)) {
            return DEFAULT_CHROME_PATH.WIN_DEV;
        } else if (coreUtils.existsSync(DEFAULT_CHROME_PATH.WIN_BETA)) {
            return DEFAULT_CHROME_PATH.WIN_BETA;
        } else if (coreUtils.existsSync(DEFAULT_CHROME_PATH.WIN_STABLE)) {
            return DEFAULT_CHROME_PATH.WIN_STABLE;
        } else if (coreUtils.existsSync(DEFAULT_CHROME_PATH.WINx86_DEV)) {
            return DEFAULT_CHROME_PATH.WINx86_DEV;
        } else if (coreUtils.existsSync(DEFAULT_CHROME_PATH.WINx86_BETA)) {
            return DEFAULT_CHROME_PATH.WINx86_BETA;
        } else if (coreUtils.existsSync(DEFAULT_CHROME_PATH.WINx86_STABLE)) {
            return DEFAULT_CHROME_PATH.WINx86_STABLE;
        } else {
            return null;
        }
    } else {
        return coreUtils.existsSync(DEFAULT_CHROME_PATH.LINUX) ? DEFAULT_CHROME_PATH.LINUX : null;
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

export const targetFilter: chromeConnection.ITargetFilter =
    target => target && (!target.type || target.type === 'page');
