/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

 /* tslint:disable */

import * as Path from 'path';
import * as URL from 'url';

import * as utils from '../../webkit/utilities';

export function getPathRoot(p: string) {
    if (p) {
        if (p.length >= 3 && p[1] === ':' && p[2] === '\\' && ((p[0] >= 'a' && p[0] <= 'z') || (p[0] >= 'A' && p[0] <= 'Z'))) {
            return p.substr(0, 3);
        }
        if (p.length > 0 && p[0] === '/') {
            return '/';
        }
    }
    return null;
}

export function makePathAbsolute(absPath: string, relPath: string): string {
    return Path.resolve(Path.dirname(absPath), relPath);
}

export function removeFirstSegment(path: string) {
    const segments = path.split(Path.sep);
    segments.shift();
    if (segments.length > 0) {
        return segments.join(Path.sep);
    }
    return null;
}

export function makeRelative(target: string, path: string) {
    const t = target.split(Path.sep);
    const p = path.split(Path.sep);

    let i = 0;
    for (; i < Math.min(t.length, p.length) && t[i] === p[i]; i++) {
    }

    let result = '';
    for (; i < p.length; i++) {
        result = Path.join(result, p[i]);
    }
    return result;
}

export function canonicalizeUrl(url: string): string {
    let u = URL.parse(url);
    let p = decodeURIComponent(u.pathname);

    if (p.length >= 4 && p[0] === '/' && p[2] === ':' && p[3] === '/' && ((p[1] >= 'a' && p[1] <= 'z') || (p[1] >= 'A' && p[1] <= 'Z'))) {
        return p.substr(1);
    }
    return p;
}

/**
 * Determine the absolute path to the sourceRoot.
 */
export function getAbsSourceRoot(sourceRoot: string, webRoot: string, generatedPath: string): string {
    let absSourceRoot: string;
    if (sourceRoot) {
        if (sourceRoot.startsWith('file:///')) {
            // sourceRoot points to a local path like "file:///c:/project/src"
            absSourceRoot = canonicalizeUrl(sourceRoot);
        } else if (Path.isAbsolute(sourceRoot)) {
            // sourceRoot is like "/src", would be like http://localhost/src, resolve to a local path under webRoot
            // note that C:/src (or /src as an absolute local path) is not a valid sourceroot
            absSourceRoot = Path.join(webRoot, sourceRoot);
        } else {
            // sourceRoot is like "src" or "../src", relative to the script
            if (Path.isAbsolute(generatedPath)) {
                absSourceRoot = makePathAbsolute(generatedPath, sourceRoot);
            } else {
                // generatedPath is a URL so runtime script is not on disk, resolve the sourceRoot location on disk
                const genDirname = Path.dirname(URL.parse(generatedPath).pathname);
                absSourceRoot =  Path.join(webRoot, genDirname, sourceRoot);
            }
        }

        utils.Logger.log(`SourceMap: resolved sourceRoot ${sourceRoot} -> ${absSourceRoot}`);
    } else {
        if (Path.isAbsolute(generatedPath)) {
            absSourceRoot = Path.dirname(generatedPath);
            utils.Logger.log(`SourceMap: no sourceRoot specified, using script dirname: ${absSourceRoot}`);
        } else {
            // runtime script is not on disk, resolve the sourceRoot location on disk
            const scriptPathDirname = Path.dirname(URL.parse(generatedPath).pathname);
            absSourceRoot =  Path.join(webRoot, scriptPathDirname);
            utils.Logger.log(`SourceMap: no sourceRoot specified, using webRoot + script path dirname: ${absSourceRoot}`);
        }
    }

    absSourceRoot = utils.stripTrailingSlash(absSourceRoot);
    absSourceRoot = utils.fixDriveLetterAndSlashes(absSourceRoot);

    return absSourceRoot;
}