/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as http from 'http';
import * as os from 'os';
import * as fs from 'fs';
import * as url from 'url';
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
                reject(timeoutMsg);
            } else {
                resolve();
            }
        }, timeoutMs);
    });
}

export function retryAsync(fn: () => Promise<any>, timeoutMs: number): Promise<any> {
    const startTime = Date.now();

    function tryUntilTimeout(): Promise<any> {
        return fn().catch(
            e => {
                if (Date.now() - startTime < timeoutMs) {
                    return tryUntilTimeout();
                } else {
                    return errP(e);
                }
            });
    }

    return tryUntilTimeout();
}

/**
 * Holds a singleton to manage access to console.log.
 * Logging is only allowed when running in server mode, because otherwise it goes through the same channel that Code uses to
 * communicate with the adapter, which can cause communication issues.
 */
export class Logger {
    private static _logger: Logger;
    private _isServer: boolean;
    private _diagnosticLogCallback: (msg: string) => void;
    private _diagnosticLoggingEnabled: boolean;

    public static log(msg: string, forceDiagnosticLogging = false): void {
        if (this._logger) this._logger._log(msg, forceDiagnosticLogging);
    }

    public static init(isServer: boolean, logCallback: (msg: string) => void): void {
        if (!this._logger) {
            this._logger = new Logger(isServer);
            this._logger._diagnosticLogCallback = logCallback;

            if (isServer) {
                Logger.logVersionInfo();
            }
        }
    }

    public static enableDiagnosticLogging(): void {
        if (this._logger) {
            this._logger._diagnosticLoggingEnabled = true;
            if (!this._logger._isServer) {
                Logger.logVersionInfo();
            }
        }
    }

    public static logVersionInfo(): void {
        Logger.log(`OS: ${os.platform() } ${os.arch() }`);
        Logger.log('Node version: ' + process.version);
        Logger.log('Adapter version: ' + require('../../package.json').version);
    }

    constructor(isServer: boolean) {
        this._isServer = isServer;
    }

    private _log(msg: string, forceDiagnosticLogging: boolean): void {
        if (this._isServer || this._diagnosticLoggingEnabled || forceDiagnosticLogging) {
            this._sendLog(msg);
        }
    }

    private _sendLog(msg: string): void {
        if (this._isServer) {
            console.log(msg);
        } else if (this._diagnosticLogCallback) {
            this._diagnosticLogCallback(msg);
        }
    }
}

/**
 * Maps a url from webkit to an absolute local path.
 * If not given an absolute path (with file: prefix), searches the current working directory for a matching file.
 * http://localhost/scripts/code.js => d:/app/scripts/code.js
 * file:///d:/scripts/code.js => d:/scripts/code.js
 */
export function webkitUrlToClientPath(webRoot: string, aUrl: string): string {
    if (!aUrl) {
        return '';
    }

    aUrl = decodeURI(aUrl);

    // If the url is an absolute path to a file that exists, return it without file:///.
    // A remote absolute url (cordova) will still need the logic below.
    if (aUrl.startsWith('file:///') && existsSync(aUrl.replace(/^file:\/\/\//, ''))) {
        return canonicalizeUrl(aUrl);
    }

    // If we don't have the client workingDirectory for some reason, don't try to map the url to a client path
    if (!webRoot) {
        return '';
    }

    // Search the filesystem under the webRoot for the file that best matches the given url
    let pathName = decodeURIComponent(url.parse(canonicalizeUrl(aUrl)).pathname);
    if (!pathName || pathName === '/') {
        return '';
    }

    // Dealing with the path portion of either a url or an absolute path to remote file.
    // Need to force path.sep separator
    pathName = pathName.replace(/\//g, path.sep);
    const pathParts = pathName.split(path.sep);
    while (pathParts.length > 0) {
        const clientPath = path.join(webRoot, pathParts.join(path.sep));
        if (existsSync(clientPath)) {
            return canonicalizeUrl(clientPath);
        }

        pathParts.shift();
    }

    return '';
}

/**
 * Modify a url either from the client or the webkit target to a common format for comparing.
 * The client can handle urls in this format too.
 * file:///D:\\scripts\\code.js => d:/scripts/code.js
 * file:///Users/me/project/code.js => /Users/me/project/code.js
 * c:\\scripts\\code.js => c:/scripts/code.js
 * http://site.com/scripts/code.js => (no change)
 * http://site.com/ => http://site.com
 */
export function canonicalizeUrl(aUrl: string): string {
    aUrl = aUrl.replace('file:///', '');
    aUrl = stripTrailingSlash(aUrl);

    aUrl = fixDriveLetterAndSlashes(aUrl);
    if (aUrl[0] !== '/' && aUrl.indexOf(':') < 0 && getPlatform() === Platform.OSX) {
        // Ensure osx path starts with /, it can be removed when file:/// was stripped.
        // Don't add if the url still has a protocol
        aUrl = '/' + aUrl;
    }

    return aUrl;
}

/**
 * Ensure lower case drive letter and \ on Windows
 */
export function fixDriveLetterAndSlashes(aPath: string): string {
    if (getPlatform() === Platform.Windows) {
        if (aPath.match(/file:\/\/\/[A-Za-z]:/)) {
            const prefixLen = 'file:///'.length;
            aPath =
                'file:///' +
                aPath[prefixLen].toLowerCase() +
                aPath.substr(prefixLen + 1).replace(/\//g, path.sep);
        } else if (aPath.match(/^[A-Za-z]:/)) {
            // If this is Windows and the path starts with a drive letter, ensure lowercase. VS Code uses a lowercase drive letter
            aPath = aPath[0].toLowerCase() + aPath.substr(1);
            aPath = aPath.replace(/\//g, path.sep);
        }
    }

    return aPath;
}

/**
 * Remove a slash of any flavor from the end of the path
 */
export function stripTrailingSlash(aPath: string): string {
    return aPath
        .replace(/\/$/, '')
        .replace(/\\$/, '');
}

export function remoteObjectToValue(object: WebKitProtocol.Runtime.RemoteObject, stringify = true): { value: string, variableHandleRef: string } {
    let value = '';
    let variableHandleRef: string;

    if (object) {
        if (object.type === 'object') {
            if (object.subtype === 'null') {
                value = 'null';
            } else {
                // If it's a non-null object, create a variable reference so the client can ask for its props
                variableHandleRef = object.objectId;
                value = object.description;
            }
        } else if (object.type === 'undefined') {
            value = 'undefined';
        } else if (object.type === 'function') {
            const firstBraceIdx = object.description.indexOf('{');
            if (firstBraceIdx >= 0) {
                value = object.description.substring(0, firstBraceIdx) + '{ … }';
            } else {
                const firstArrowIdx = object.description.indexOf('=>');
                value = firstArrowIdx >= 0 ?
                    object.description.substring(0, firstArrowIdx + 2) + ' …' :
                    object.description;
            }
        } else {
            // The value is a primitive value, or something that has a description (not object, primitive, or undefined). And force to be string
            if (typeof object.value === 'undefined') {
                value = object.description;
            } else {
                value = stringify ? JSON.stringify(object.value) : object.value;
            }
        }
    }

    return { value, variableHandleRef };
}

/**
 * A helper for returning a rejected promise with an Error object. Avoids double-wrapping an Error, which could happen
 * when passing on a failure from a Promise error handler.
 * @param msg - Should be either a string or an Error
 */
export function errP(msg: any): Promise<any> {
    let e: Error;
    if (!msg) {
        e = new Error('Unknown error');
    } else if (msg.message) {
        // msg is already an Error object
        e = msg;
    } else {
        e = new Error(msg);
    }

    return Promise.reject(e);
}

/**
 * Calculates the webRoot from a launch/attach request. The webRoot is the directory that the
 * files are served from by a web server, (or the directory that they would be served from, and which
 * sourceRoot may be relative to).
 */
export function getWebRoot(args: ILaunchRequestArgs | IAttachRequestArgs): string {
    let webRoot: string;
    if (args.webRoot) {
        webRoot = args.webRoot;
        if (!path.isAbsolute(webRoot)) {
            webRoot = path.resolve(args.cwd, webRoot);
        }
    } else {
        webRoot = args.cwd;
    }

    return webRoot;
}

/**
 * Helper function to GET the contents of a url
 */
export function getURL(aUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
        http.get(aUrl, response => {
            let responseData = '';
            response.on('data', chunk => responseData += chunk);
            response.on('end', () => {
                // Sometimes the 'error' event is not fired. Double check here.
                if (response.statusCode === 200) {
                    resolve(responseData);
                } else {
                    reject(responseData);
                }
            });
        }).on('error', e => {
            reject(e);
        });
    });
}

/**
 * Returns true if urlOrPath is like "http://localhost" and not like "c:/code/file.js" or "/code/file.js"
 */
export function isURL(urlOrPath: string): boolean {
    return urlOrPath && !path.isAbsolute(urlOrPath) && !!url.parse(urlOrPath).protocol;
}

/**
 * Strip a string from the left side of a string
 */
export function lstrip(s: string, lStr: string): string {
    return s.startsWith(lStr) ?
        s.substr(lStr.length) :
        s;
}

/**
 * Convert a local path to a file URL, like
 * C:/code/app.js => file:///C:/code/app.js
 * /code/app.js => file:///code/app.js
 */
export function pathToFileURL(path: string): string {
    return (path.startsWith('/') ? 'file://' : 'file:///') +
        path;
}