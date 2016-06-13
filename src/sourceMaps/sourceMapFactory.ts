/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs';

import * as sourceMapUtils from './sourceMapUtils';
import * as utils from '../utils';
import * as logger from '../logger';
import {SourceMap} from './sourceMap';

/**
 * pathToGenerated - an absolute local path or a URL.
 * mapPath - a path relative to pathToGenerated.
 */
export function getMapForGeneratedPath(pathToGenerated: string, mapPath: string, webRoot: string): Promise<SourceMap> {
    logger.log(`SourceMaps.getMapForGeneratedPath: Finding SourceMap for ${pathToGenerated} by URI: ${mapPath} and webRoot: ${webRoot}`);

    // For an inlined sourcemap, mapPath is a data URI containing a blob of base64 encoded data, starting
    // with a tag like "data:application/json;charset:utf-8;base64,". The data should start after the last comma.
    let sourceMapContentsP: Promise<string>;
    if (mapPath.indexOf('data:application/json') >= 0) {
        // Sourcemap is inlined
        logger.log(`SourceMaps.getMapForGeneratedPath: Using inlined sourcemap in ${pathToGenerated}`);
        sourceMapContentsP = Promise.resolve(getInlineSourceMapContents(mapPath));
    } else {
        sourceMapContentsP = getSourceMapContent(pathToGenerated, mapPath);
    }

    return sourceMapContentsP.then(contents => {
        if (contents) {
            try {
                // Throws for invalid JSON
                return new SourceMap(pathToGenerated, contents, webRoot);
            } catch (e) {
                logger.error(`SourceMaps.getMapForGeneratedPath: exception while processing sourcemap: ${e.stack}`);
                return null;
            }
        } else {
            return null;
        }
    });
}

/**
 * Parses sourcemap contents from inlined base64-encoded data
 */
function getInlineSourceMapContents(sourceMapData: string): string {
    const lastCommaPos = sourceMapData.lastIndexOf(',');
    if (lastCommaPos < 0) {
        logger.log(`SourceMaps.getInlineSourceMapContents: Inline sourcemap is malformed. Starts with: ${sourceMapData.substr(0, 200)}`);
        return null;
    }

    const data = sourceMapData.substr(lastCommaPos + 1);
    try {
        const buffer = new Buffer(data, 'base64');
        return buffer.toString();
    } catch (e) {
        logger.error(`SourceMaps.getInlineSourceMapContents: exception while processing data uri (${e.stack})`);
    }

    return null;
}

/**
 * Resolves a sourcemap's path and loads the data
 */
function getSourceMapContent(pathToGenerated: string, mapPath: string): Promise<string> {
    if (!path.isAbsolute(mapPath)) {
        // mapPath needs to be resolved to an absolute path or a URL
        if (path.isAbsolute(pathToGenerated)) {
            // runtime script is on disk, so map should be too
            mapPath = sourceMapUtils.resolveRelativeToFile(pathToGenerated, mapPath);
        } else {
            // runtime script is not on disk, resolve a URL for the map relative to the script
            const scriptUrl = url.parse(pathToGenerated);
            mapPath = `${scriptUrl.protocol}//${scriptUrl.host}${path.dirname(scriptUrl.pathname)}/${mapPath}`;
        }
    }

    return loadSourceMapContents(mapPath).then(contents => {
        if (!contents) {
            // Last ditch effort - just look for a .js.map next to the script
            const mapPathNextToSource = pathToGenerated + '.map';
            if (mapPathNextToSource !== mapPath) {
                return loadSourceMapContents(mapPathNextToSource);
            }
        }

        return contents;
    });
}

function loadSourceMapContents(mapPathOrURL: string): Promise<string> {
    let contentsP: Promise<string>;
    if (utils.isURL(mapPathOrURL)) {
        logger.log(`SourceMaps.loadSourceMapContents: Downloading sourcemap file from ${mapPathOrURL}`);
        contentsP = utils.getURL(mapPathOrURL).catch(e => {
            logger.error(`SourceMaps.loadSourceMapContents: Could not download sourcemap from ${mapPathOrURL}`);
            return null;
        });
    } else {
        contentsP = new Promise((resolve, reject) => {
            logger.log(`SourceMaps.loadSourceMapContents: Reading local sourcemap file from ${mapPathOrURL}`);
            fs.readFile(mapPathOrURL, (err, data) => {
                if (err) {
                    logger.error(`SourceMaps.loadSourceMapContents: Could not read sourcemap from ${mapPathOrURL}`);
                    resolve(null);
                } else {
                    resolve(data);
                }
            });
        });
    }

    return contentsP;
}