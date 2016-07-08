/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as path from 'path';
import * as url from 'url';

import * as utils from '../utils';
import * as logger from '../logger';
import {ISourceMapPathOverrides} from '../debugAdapterInterfaces';

/**
 * Resolves a relative path in terms of another file
 */
export function resolveRelativeToFile(absPath: string, relPath: string): string {
    return path.resolve(path.dirname(absPath), relPath);
}

/**
 * Determine the absolute path to the sourceRoot.
 */
export function getComputedSourceRoot(sourceRoot: string, generatedPath: string, webRoot?: string): string {
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

/**
 * Returns a copy of sourceMapPathOverrides with the ${webRoot} pattern resolved in all entries.
 */
export function resolveWebRootPattern(webRoot: string, sourceMapPathOverrides: ISourceMapPathOverrides): ISourceMapPathOverrides {
    const resolvedOverrides: ISourceMapPathOverrides = {};
    for (let pattern in sourceMapPathOverrides) {
        const replacePattern = sourceMapPathOverrides[pattern];
        resolvedOverrides[pattern] = replacePattern;

        const webRootIndex = replacePattern.indexOf('${webRoot}');
        if (webRootIndex === 0) {
            if (webRoot) {
                resolvedOverrides[pattern] = replacePattern.replace('${webRoot}', webRoot);
            } else {
                logger.log('Warning: sourceMapPathOverrides entry contains ${webRoot}, but webRoot is not set');
            }
        } else if (webRootIndex > 0) {
            logger.log('Warning: in a sourceMapPathOverrides entry, ${webRoot} is only valid at the beginning of the path');
        }
    }

    return resolvedOverrides;
}

/**
 * Applies a set of path pattern mappings to the given path. See tests for examples.
 * Returns something validated to be an absolute path.
 */
export function applySourceMapPathOverrides(sourcePath: string, sourceMapPathOverrides: ISourceMapPathOverrides): string {
    // Iterate the key/vals, only apply the first one that matches
    for (let pattern in sourceMapPathOverrides) {
        let replacePattern = sourceMapPathOverrides[pattern];
        const entryStr = `"${pattern}": "${replacePattern}"`;

        // Validate the entry
        if (!path.isAbsolute(replacePattern)) {
            logger.log(`Warning: sourceMapPathOverrides entry does not map to an absolute path - ${entryStr}`);
            continue;
        }

        const asterisks = pattern.match(/\*/g) || [];
        if (asterisks.length > 1) {
            logger.log(`Warning: only one asterisk allowed in a sourceMapPathOverrides entry - ${entryStr}`);
            continue;
        }

        const replacePatternAsterisks = replacePattern.match(/\*/g) || [];
        if (replacePatternAsterisks.length > asterisks.length) {
            logger.log(`Warning: the right side of a sourceMapPathOverrides entry must have 0 or 1 asterisks - ${entryStr}}`);
            continue;
        }

        // Does it match?
        const patternRegex = new RegExp('^' + pattern.replace(/\*/g, '(.*)') + '$', 'i');
        const overridePatternMatches = sourcePath.match(patternRegex);
        if (!overridePatternMatches)
            continue;

        // Grab the value of the wildcard from the match above, replace the wildcard in the
        // replacement pattern, and return the result.
        const wildcardValue = overridePatternMatches[1];
        let mappedPath = replacePattern.replace(/\*/g, wildcardValue);
        mappedPath = path.join(mappedPath); // Fix any ..
        logger.log(`SourceMap: mapping ${sourcePath} => ${mappedPath}, via sourceMapPathOverrides entry - ${entryStr}`);
        return mappedPath;
    }

    return sourcePath;
}