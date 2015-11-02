/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as os from 'os';
import * as fs from 'fs';
import * as nodeUrl from 'url';
import * as path from 'path';

const DEFAULT_CHROME_PATH = {
    OSX: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    WIN: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    WINx86: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    LINUX: '/usr/bin/google-chrome'
};

export function getBrowserPath(): string {
    const platform = getPlatform();
    if (platform === Platform.OSX) {
        return existsSync(DEFAULT_CHROME_PATH.OSX) ? DEFAULT_CHROME_PATH.OSX : null;
    } else if (platform === Platform.Windows) {
        if (existsSync(DEFAULT_CHROME_PATH.WINx86)) {
            return DEFAULT_CHROME_PATH.WINx86;
        } else if (existsSync(DEFAULT_CHROME_PATH.WIN)) {
            return DEFAULT_CHROME_PATH.WIN;
        } else {
            return null;
        }
    } else {
        return existsSync(DEFAULT_CHROME_PATH.LINUX) ? DEFAULT_CHROME_PATH.LINUX : null;
    }
}

export const enum Platform {
    Windows, OSX, Linux
}

export function getPlatform(): Platform {
    const platform = os.platform();
    return platform === 'darwin' ? Platform.OSX :
        platform === 'win32' ? Platform.Windows :
        Platform.Linux;
}

/**
 * Node's fs.existsSync is deprecated, implement it in terms of statSync
 */
export function existsSync(path: string): boolean {
    try {
        fs.statSync(path);
        return true;
    } catch (e) {
        // doesn't exist
        return false;
    }
}

export class DebounceHelper {
    private waitToken: NodeJS.Timer;

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

/**
 * Returns a reversed version of arr. Doesn't modify the input.
 */
export function reversedArr(arr: any[]): any[] {
    return arr.reduce((reversed: any[], x: any) => {
        reversed.unshift(x);
        return reversed;
    }, []);
}

export function promiseTimeout(p?: Promise<any>, timeoutMs: number = 1000, timeoutMsg?: string): Promise<any> {
    if (timeoutMsg === undefined) {
        timeoutMsg = `Promise timed out after ${timeoutMs}ms`;
    }

    return new Promise((resolve, reject) => {
        if (p) {
            p.then(resolve, reject);
        }

        setTimeout(() => {
            if (p) {
                reject();
            } else {
                resolve();
            }
        }, timeoutMs);
    });
}

export function retryAsync(fn: () => Promise<any>, attempts: number, timeoutBetweenAttempts = 200): Promise<any> {
    if (attempts <= 0) return Promise.reject('Must specify > 0 attempts');

    return fn().catch(
        e => {
            if (--attempts > 0) {
                // Wait some ms, then recurse
                return promiseTimeout(null, timeoutBetweenAttempts)
                    .then(() => retryAsync(fn, attempts, timeoutBetweenAttempts));
            } else {
                return Promise.reject(e);
            }
        });
}

/**
 * Holds a singleton to manage access to console.log.
 * Logging is only allowed when running in server mode, because otherwise it goes through the same channel that Code uses to
 * communicate with the adapter, which can cause communication issues.
 * ALLOW_LOGGING should be set to false when packaging and releasing to ensure it's always disabled.
 */
export class Logger {
    private static ALLOW_LOGGING = true;

    private static _logger: Logger;
    private _isServer: boolean;
    private _logSeparatorTimeoutToken: NodeJS.Timer;

    public static log(msg: string): void {
        if (this._logger) this._logger._log(msg);
    }

    public static init(isServer: boolean): void {
        if (!this._logger) {
            this._logger = new Logger(isServer);
        }
    }

    constructor(isServer: boolean) {
        this._isServer = isServer;
    }

    private _log(msg: string): void {
        if (this._isServer && Logger.ALLOW_LOGGING) {
            console.log(msg);

            if (this._logSeparatorTimeoutToken) {
                clearTimeout(this._logSeparatorTimeoutToken);
            }

            this._logSeparatorTimeoutToken = setTimeout(() => {
                // Logs tend to come in bursts, so this is useful for providing separation between groups of events that were logged at the same time
                console.log('-\n-\n-');
            }, 2000);
        }
    }
}

/**
 * Maps a url from webkit to an absolute local path.
 * If not given an absolute path (with file: prefix), searches the current working directory for a matching file.
 * http://localhost/scripts/code.js => d:/app/scripts/code.js
 * file:///d:/scripts/code.js => d:/scripts/code.js
 */
export function webkitUrlToClientUrl(cwd: string, url: string): string {
    if (!url) {
        return '';
    }

    // If a file:/// url is loaded in the client, just send the absolute path of the file
    const prefix = 'file:///';
    if (url.substr(0, prefix.length) === prefix) {
        return canonicalizeUrl(url);
    }

    // If we don't have the client workingDirectory for some reason, don't try to map the url to a client path
    if (!cwd) {
        return '';
    }

    // Search the filesystem under our cwd for the file that best matches the given url
    const pathName = nodeUrl.parse(canonicalizeUrl(url)).pathname;
    if (!pathName || pathName === '/') {
        return '';
    }

    const pathParts = pathName.split('/');
    while (pathParts.length > 0) {
        const clientUrl = path.join(cwd, pathParts.join('/'));
        const canClientUrl = canonicalizeUrl(clientUrl); // path.join will change / to \
        if (existsSync(canClientUrl)) {
            return canonicalizeUrl(canClientUrl);
        }

        pathParts.shift();
    }

    return '';
}

/**
 * Modify a url either from the client or the webkit target to a platform-independent format for comparing.
 * The client can handle urls in this format too.
 * file:///D:\\scripts\\code.js => d:/scripts/code.js
 * file:///Users/me/project/code.js => /Users/me/project/code.js
 * c:\scripts\code.js => c:/scripts/code.js
 * http://site.com/scripts/code.js => (no change)
 */
export function canonicalizeUrl(url: string): string {
    url = url
        .replace('file:///', '')
        .replace(/\\/g, '/'); // \ to /

    // Ensure osx path starts with /, it can be removed when file:/// was stripped.
    // Don't add if the url still has a protocol
    if (url[0] !== '/' && url.indexOf(':') < 0 && getPlatform() === Platform.OSX) {
        url = '/' + url;
    }

    // VS Code gives a lowercase drive letter
    if (url.match(/^[A-Z]:\//) && getPlatform() === Platform.Windows) {
        url = url[0].toLowerCase() + url.substr(1);
    }

    return url;
}
