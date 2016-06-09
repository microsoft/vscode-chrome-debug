/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs';

import * as pathUtils from './pathUtilities';
import * as utils from '../../utils';
import * as logger from '../../logger';
import {SourceMap, MappedPosition} from './sourceMap';

export class SourceMaps {
    // Maps absolute paths to generated/authored source files to their corresponding SourceMap object
    private _generatedPathToSourceMap = new Map<string, SourceMap>();
    private _authoredPathToSourceMap = new Map<string, SourceMap>();

    // Path to resolve / paths against
    private _webRoot: string;

    public constructor(webRoot: string) {
        this._webRoot = webRoot;
    }

    /**
     * Returns the generated script path for an authored source path
     * @param pathToSource - The absolute path to the authored file
     */
    public getGeneratedPathFromAuthoredPath(authoredPath: string): string {
        const map = this.findMapFromAuthoredPath(authoredPath);
        return map ? map.generatedPath() : null;
    }

    public mapToGenerated(authoredPath: string, line: number, column: number): MappedPosition {
        const map = this.findMapFromAuthoredPath(authoredPath);
        return map ? map.generatedPositionFor(authoredPath, line, column) : null;
    }

    public mapToSource(pathToGenerated: string, line: number, column: number): MappedPosition {
        const map = this._generatedPathToSourceMap.get(pathToGenerated);
        return map ? map.authoredPositionFor(line, column) : null;
    }

    public allMappedSources(pathToGenerated: string): string[] {
        const map = this._generatedPathToSourceMap.get(pathToGenerated);
        return map ? map.sources : null;
    }

    public processNewSourceMap(pathToGenerated: string, sourceMapURL: string): Promise<void> {
        return this.findMapFromGeneratedPath(pathToGenerated, sourceMapURL).then(() => { });
    }

    private findMapFromAuthoredPath(authoredPath: string): SourceMap {
        if (this._authoredPathToSourceMap.has(authoredPath)) {
            return this._authoredPathToSourceMap.get(authoredPath);
        }

        // Hack because TS - ES5 won't do any other Iterable iteration
        // Honestly probably better to populate the authored cache when the sourcemap is loaded
        // Search all existing SourceMaps for one which maps this authored path
        const values = this._generatedPathToSourceMap.values();
        let curr: IteratorResult<SourceMap>;
        while ((curr = values.next()) && !curr.done) {
            const sourceMap = curr.value;
            if (sourceMap.doesOriginateFrom(authoredPath)) {
                this._authoredPathToSourceMap.set(authoredPath, sourceMap);
                return sourceMap;
            }
        }

        // Not found in existing maps
        return null;
    }

    /**
     * pathToGenerated - an absolute local path or a URL.
     * mapPath - a path relative to pathToGenerated.
     */
    private findMapFromGeneratedPath(pathToGenerated: string, mapPath: string): Promise<SourceMap> {
        if (this._generatedPathToSourceMap.has(pathToGenerated)) {
            return Promise.resolve(this._generatedPathToSourceMap.get(pathToGenerated));
        }

        // For an inlined sourcemap, mapPath is a data URI containing a blob of base64 encoded data, starting
        // with a tag like "data:application/json;charset:utf-8;base64,". The data should start after the last comma.
        let sourceMapContentsP: Promise<string>;
        if (mapPath.indexOf('data:application/json') >= 0) {
            // Sourcemap is inlined
            return Promise.resolve(this.createInlineSourceMap(pathToGenerated, mapPath));
        }

        // mapPath needs to be resolved to an absolute path or a URL
        if (!path.isAbsolute(mapPath)) {
            if (path.isAbsolute(pathToGenerated)) {
                // runtime script is on disk, so map should be too
                mapPath = pathUtils.makePathAbsolute(pathToGenerated, mapPath);
            } else {
                // runtime script is not on disk, resolve a URL for the map relative to the script
                const scriptUrl = url.parse(pathToGenerated);
                mapPath = `${scriptUrl.protocol}//${scriptUrl.host}${path.dirname(scriptUrl.pathname)}/${mapPath}`;
            }
        }

        return this.createSourceMap(mapPath, pathToGenerated).then(map => {
            if (!map) {
                // Last ditch effort - just look for a .js.map next to the script
                const mapPathNextToSource = pathToGenerated + '.map';
                if (mapPathNextToSource !== mapPath) {
                    return this.createSourceMap(mapPathNextToSource, pathToGenerated);
                }
            }

            return map;
        }).then(map => {
            if (map) {
                this._generatedPathToSourceMap.set(pathToGenerated, map);
                // And populate the other map
            }

            return map;
        });
    }

    /**
     * Creates a SourceMap from inlined sourcemap data
     */
    private createInlineSourceMap(pathToGenerated: string, sourceMapData: string): SourceMap {
        logger.log(`SourceMaps.createInlineSourceMap: Using inlined sourcemap in ${pathToGenerated}`);

        const lastCommaPos = sourceMapData.lastIndexOf(',');
        if (lastCommaPos < 0) {
            logger.log(`SourceMaps.createInlineSourceMap: Inline sourcemap is malformed. Starts with: ${sourceMapData.substr(0, 200)}`);
            return null;
        }

        const data = sourceMapData.substr(lastCommaPos + 1);
        try {
            const buffer = new Buffer(data, 'base64');
            const json = buffer.toString();
            if (json) {
                const map = new SourceMap(pathToGenerated, json, this._webRoot);
                this._generatedPathToSourceMap.set(pathToGenerated, map);
                return map;
            }
        } catch (e) {
            logger.log(`SourceMaps.createInlineSourceMap: exception while processing data url (${e.stack})`);
        }

        return null;
    }

    private createSourceMap(mapPathOrURL: string, pathToGenerated: string): Promise<SourceMap> {
        let contentsP: Promise<string>;
        if (utils.isURL(mapPathOrURL)) {
            logger.log(`SourceMaps.createSourceMap: Downloading sourcemap file from ${mapPathOrURL}`);
            contentsP = utils.getURL(mapPathOrURL).catch(e => {
                logger.log(`SourceMaps.createSourceMap: Could not download map from ${mapPathOrURL}`);
                return null;
            });
        } else {
            contentsP = new Promise((resolve, reject) => {
                logger.log(`SourceMaps.createSourceMap: Reading local sourcemap file from ${mapPathOrURL}`);
                fs.readFile(mapPathOrURL, (err, data) => {
                    if (err) {
                        logger.log(`SourceMaps.createSourceMap: Could not read map from ${mapPathOrURL}`);
                        resolve(null);
                    } else {
                        resolve(data);
                    }
                });
            });
        }

        return contentsP.then(contents => {
            if (contents) {
                try {
                    // Throws for invalid contents JSON
                    return new SourceMap(pathToGenerated, contents, this._webRoot);
                } catch (e) {
                    logger.log(`SourceMaps.createSourceMap: exception while processing sourcemap: ${e.stack}`);
                    return null;
                }
            } else {
                return null;
            }
        });
    }
}
