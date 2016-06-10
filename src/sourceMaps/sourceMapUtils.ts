/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as path from 'path';
import * as url from 'url';

import * as utils from '../utils';
import * as logger from '../logger';

/**
 * Resolves a relative path in terms of another file
 */
export function resolveRelativeToFile(absPath: string, relPath: string): string {
    return path.resolve(path.dirname(absPath), relPath);
}

/**
 * Determine the absolute path to the sourceRoot.
 */
export function getAbsSourceRoot(sourceRoot: string, webRoot: string, generatedPath: string): string {
    let absSourceRoot: string;
    if (sourceRoot) {
        if (sourceRoot.startsWith('file:///')) {
            // sourceRoot points to a local path like "file:///c:/project/src", make it an absolute path
            absSourceRoot = utils.canonicalizeUrl(sourceRoot);
        } else if (sourceRoot.startsWith('/')) {
            // sourceRoot is like "/src", would be like http://localhost/src, resolve to a local path under webRoot
            // note that C:/src (or /src as an absolute local path) is not a valid sourceroot
            absSourceRoot = path.join(webRoot, sourceRoot);
        } else {
            // sourceRoot is like "src" or "../src", relative to the script
            if (path.isAbsolute(generatedPath)) {
                absSourceRoot = resolveRelativeToFile(generatedPath, sourceRoot);
            } else {
                // generatedPath is a URL so runtime script is not on disk, resolve the sourceRoot location on disk
                const genDirname = path.dirname(url.parse(generatedPath).pathname);
                absSourceRoot =  path.join(webRoot, genDirname, sourceRoot);
            }
        }

        logger.log(`SourceMap: resolved sourceRoot ${sourceRoot} -> ${absSourceRoot}`);
    } else if (path.isAbsolute(generatedPath)) {
        absSourceRoot = path.dirname(generatedPath);
        logger.log(`SourceMap: no sourceRoot specified, using script dirname: ${absSourceRoot}`);
    } else {
        // runtime script is not on disk, resolve the sourceRoot location on disk
        const scriptPathDirname = path.dirname(url.parse(generatedPath).pathname);
        absSourceRoot =  path.join(webRoot, scriptPathDirname);
        logger.log(`SourceMap: no sourceRoot specified, using webRoot + script path dirname: ${absSourceRoot}`);
    }

    absSourceRoot = utils.stripTrailingSlash(absSourceRoot);
    absSourceRoot = utils.fixDriveLetterAndSlashes(absSourceRoot);

    return absSourceRoot;
}