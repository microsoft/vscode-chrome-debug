/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as os from 'os';
import * as fs from 'fs';
import * as url from 'url';
import * as path from 'path';
import * as glob from 'glob';
import {Handles} from 'vscode-debugadapter';

import * as xhr from 'request-light';

import * as logger from './logger';

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

export function promiseTimeout(p?: Promise<any>, timeoutMs = 1000, timeoutMsg?: string): Promise<any> {
    if (timeoutMsg === undefined) {
        timeoutMsg = `Promise timed out after ${timeoutMs}ms`;
    }

    return new Promise((resolve, reject) => {
        if (p) {
            p.then(resolve, reject);
        }

        setTimeout(() => {
            if (p) {
                reject(new Error(timeoutMsg));
            } else {
                resolve();
            }
        }, timeoutMs);
    });
}

export function retryAsync(fn: () => Promise<any>, timeoutMs: number, intervalDelay = 0): Promise<any> {
    const startTime = Date.now();

    function tryUntilTimeout(): Promise<any> {
        return fn().catch(
            e => {
                if (Date.now() - startTime < (timeoutMs - intervalDelay)) {
                    return promiseTimeout(null, intervalDelay).then(tryUntilTimeout);
                } else {
                    return errP(e);
                }
            });
    }

    return tryUntilTimeout();
}

/**
 * Modify a url/path either from the client or the target to a common format for comparing.
 * The client can handle urls in this format too.
 * file:///D:\\scripts\\code.js => d:/scripts/code.js
 * file:///Users/me/project/code.js => /Users/me/project/code.js
 * c:/scripts/code.js => c:\\scripts\\code.js
 * http://site.com/scripts/code.js => (no change)
 * http://site.com/ => http://site.com
 */
export function canonicalizeUrl(urlOrPath: string): string {
    urlOrPath = fileUrlToPath(urlOrPath);

    // Remove query params
    if (urlOrPath.indexOf('?') >= 0) {
        urlOrPath = urlOrPath.split('?')[0];
    }

    urlOrPath = stripTrailingSlash(urlOrPath);
    urlOrPath = fixDriveLetterAndSlashes(urlOrPath);

    return urlOrPath;
}

/**
 * If urlOrPath is a file URL, removes the 'file:///', adjusting for platform differences
 */
export function fileUrlToPath(urlOrPath: string): string {
    if (urlOrPath.startsWith('file:///')) {
        urlOrPath = urlOrPath.replace('file:///', '');
        urlOrPath = decodeURIComponent(urlOrPath);
        if (urlOrPath[0] !== '/' && urlOrPath.indexOf(':') < 0) {
            // Ensure unix-style path starts with /, it can be removed when file:/// was stripped.
            // Don't add if the url still has a protocol
            urlOrPath = '/' + urlOrPath;
        }

        urlOrPath = fixDriveLetterAndSlashes(urlOrPath);
    }

    return urlOrPath;
}

/**
 * Replace any backslashes with forward slashes
 * blah\something => blah/something
 */
export function forceForwardSlashes(aUrl: string): string {
    return aUrl.replace(/\\/g, '/');
}

/**
 * Ensure lower case drive letter and \ on Windows
 */
export function fixDriveLetterAndSlashes(aPath: string): string {
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

/**
 * A helper for returning a rejected promise with an Error object. Avoids double-wrapping an Error, which could happen
 * when passing on a failure from a Promise error handler.
 * @param msg - Should be either a string or an Error
 */
export function errP(msg: string|Error): Promise<any> {
    const isErrorLike = (thing: any): thing is Error => !!thing.message;

    let e: Error;
    if (!msg) {
        e = new Error('Unknown error');
    } else if (isErrorLike(msg)) {
        // msg is already an Error object
        e = msg;
    } else {
        e = new Error(msg);
    }

    return Promise.reject(e);
}

/**
 * Helper function to GET the contents of a url
 */
export function getURL(aUrl: string): Promise<string> {
    const options: xhr.XHROptions = {
        url: aUrl,
        followRedirects: 5
    };

    return xhr.xhr(options)
        .then(xhrResponse => xhrResponse.responseText)
        .catch(e => {
            const errMsg = typeof e.status === 'number' ?
                e.status + ' - ' + xhr.getErrorStatusDescription(e.status) :
                e.toString();

            logger.log('HTTP - GET failed with: ' + errMsg);
            return errP(errMsg);
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
export function pathToFileURL(absPath: string): string {
    absPath = forceForwardSlashes(absPath);
    absPath = (absPath.startsWith('/') ? 'file://' : 'file:///') +
        absPath;
    return encodeURI(absPath);
}

/**
 * Placeholder localize function
 */
export function localize(idOrInfo: any, msg: string, ...args: any[]): string {
    args.forEach((arg, i) => {
        msg = msg.replace(new RegExp(`\\{${i}\\}`, 'g'), arg);
    });

    return msg;
}

export function fsReadDirP(path: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        fs.readdir(path, (err, files) => {
            if (err) {
                reject(err);
            } else {
                resolve(files);
            }
        });
    });
}

export function readFileP(path: string, encoding = 'utf8'): Promise<string> {
    return new Promise((resolve, reject) => {
        fs.readFile(path, encoding, (err, fileContents) => {
            if (err) {
                reject(err);
            } else {
                resolve(fileContents);
            }
        });
    });
}

export function writeFileP(filePath: string, data: string): Promise<string> {
    return new Promise((resolve, reject) => {
        mkdirs(path.dirname(filePath));
        fs.writeFile(filePath, data, err => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

/**
 * Make sure that all directories of the given path exist (like mkdir -p).
 */
export function mkdirs(dirsPath: string) {
    if (!fs.existsSync(dirsPath)) {
        mkdirs(path.dirname(dirsPath));
        fs.mkdirSync(dirsPath);
    }
}

// ---- globbing support -------------------------------------------------
export function extendObject<T>(objectCopy: T, object: T): T {
    for (let key in object) {
        if (object.hasOwnProperty(key)) {
            objectCopy[key] = object[key];
        }
    }

    return objectCopy;
}

function isExclude(pattern: string) {
    return pattern[0] === '!';
}

interface IGlobTask {
    pattern: string;
    opts: any;
}

export function multiGlob(patterns: string[], opts?: any): Promise<string[]> {
    const globTasks: IGlobTask[] = [];

    opts = extendObject({
        cache: Object.create(null),
        statCache: Object.create(null),
        realpathCache: Object.create(null),
        symlinks: Object.create(null),
        ignore: []
    }, opts);

    try {
        patterns.forEach((pattern, i) => {
            if (isExclude(pattern)) {
                return;
            }

            const ignore = patterns.slice(i).filter(isExclude).map(excludePattern => {
                return excludePattern.slice(1);
            });

            globTasks.push({
                pattern,
                opts: extendObject(extendObject({}, opts), {
                    ignore: opts.ignore.concat(ignore)
                })
            });
        });
    } catch (err) {
        return Promise.reject(err);
    }

    return Promise.all(globTasks.map(task => {
        return new Promise<string[]>((c, e) => {
            glob(task.pattern, task.opts, (err, files: string[]) => {
                if (err) {
                    e(err);
                } else {
                    c(files);
                }
            });
        });
    })).then(results =>  {
        const set = new Set<string>();
        for (let paths of results) {
            for (let p of paths) {
                set.add(p);
            }
        }

        let array = [];
        set.forEach(v => array.push(v));
        return array;
    });
}

export class ReverseHandles<T> extends Handles<T> {
    private _reverseMap = new Map<T, number>();

    public create(value: T): number {
        const handle = super.create(value);
        this._reverseMap.set(value, handle);

        return handle;
    }

    public lookup(value: T): number {
        return this._reverseMap.get(value);
    }
}