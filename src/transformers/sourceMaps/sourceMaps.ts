/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs';

import * as pathUtils from './pathUtilities';
import * as utils from '../../utils';
import * as logger from '../../logger';
import {SourceMap} from './sourceMap';

export interface MappingResult {
    path: string;
    line: number;
    column: number;
}

export class SourceMaps {
    public static TRACE = false;

    private _generatedToSourceMaps: { [id: string]: SourceMap; } = {}; // generated -> source file
    private _sourceToGeneratedMaps: { [id: string]: SourceMap; } = {}; // source file -> generated

    // Path to resolve / paths against
    private _webRoot: string;

    public constructor(webRoot: string) {
        this._webRoot = webRoot;
    }

    public mapPathFromSource(pathToSource: string): string {
        const map = this.findSourceToGeneratedMapping(pathToSource);
        return map ? map.generatedPath() : null;
    }

    public mapFromSource(pathToSource: string, line: number, column: number): MappingResult {
        const map = this.findSourceToGeneratedMapping(pathToSource);
        if (map) {
            // source map impl is 1 based
            line += 1;
            const position = map.generatedPositionFor(pathToSource, line, column);
            if (position) {
                if (SourceMaps.TRACE) logger.log(`${path.basename(pathToSource)} ${line}:${column} -> ${position.line}:${position.column}`);
                return {
                    path: map.generatedPath(),
                    line: position.line - 1,
                    column: position.column
                };
            }
        }

        return null;
    }

    public mapToSource(pathToGenerated: string, line: number, column: number): MappingResult {
        const map = this._generatedToSourceMaps[pathToGenerated];
        if (map) {
            // source map impl is 1 based
            line += 1;
            const position = map.originalPositionFor(line, column);
            if (position) {
                if (SourceMaps.TRACE) logger.log(`${path.basename(pathToGenerated)} ${line}:${column} -> ${position.line}:${position.column}`);
                return {
                    path: position.source,
                    line: position.line - 1,
                    column: position.column
                };
            }
        }

        return null;
    }

    public allMappedSources(pathToGenerated: string): string[] {
        const map = this._generatedToSourceMaps[pathToGenerated];
        return map ? map.sources : null;
    }

    public processNewSourceMap(pathToGenerated: string, sourceMapURL: string): Promise<void> {
        return this._findGeneratedToSourceMapping(pathToGenerated, sourceMapURL).then(() => { });
    }

    private findSourceToGeneratedMapping(pathToSource: string): SourceMap {
        if (pathToSource) {
            if (pathToSource in this._sourceToGeneratedMaps) {
                return this._sourceToGeneratedMaps[pathToSource];
            }

            for (let key in this._generatedToSourceMaps) {
                const m = this._generatedToSourceMaps[key];
                if (m.doesOriginateFrom(pathToSource)) {
                    this._sourceToGeneratedMaps[pathToSource] = m;
                    return m;
                }
            }
        }

        // not found in existing maps
        return null;
    }

    /**
     * pathToGenerated - an absolute local path or a URL.
     * mapPath - a path relative to pathToGenerated.
     */
    private _findGeneratedToSourceMapping(pathToGenerated: string, mapPath: string): Promise<SourceMap> {
        if (!pathToGenerated) {
            return Promise.resolve(null);
        }

        if (pathToGenerated in this._generatedToSourceMaps) {
            return Promise.resolve(this._generatedToSourceMaps[pathToGenerated]);
        }

        if (mapPath.indexOf('data:application/json') >= 0) {
            logger.log(`SourceMaps.findGeneratedToSourceMapping: Using inlined sourcemap in ${pathToGenerated}`);

            // sourcemap is inlined
            const pos = mapPath.lastIndexOf(',');
            const data = mapPath.substr(pos + 1);
            try {
                const buffer = new Buffer(data, 'base64');
                const json = buffer.toString();
                if (json) {
                    const map = new SourceMap(pathToGenerated, json, this._webRoot);
                    this._generatedToSourceMaps[pathToGenerated] = map;
                    return Promise.resolve(map);
                }
            } catch (e) {
                logger.log(`SourceMaps.findGeneratedToSourceMapping: exception while processing data url (${e.stack})`);
            }

            return null;
        }

        // if path is relative make it absolute
        if (!path.isAbsolute(mapPath)) {
            if (path.isAbsolute(pathToGenerated)) {
                // runtime script is on disk, so map should be too
                mapPath = pathUtils.makePathAbsolute(pathToGenerated, mapPath);
            } else {
                // runtime script is not on disk, construct the full url for the source map
                const scriptUrl = url.parse(pathToGenerated);
                mapPath = `${scriptUrl.protocol}//${scriptUrl.host}${path.dirname(scriptUrl.pathname)}/${mapPath}`;
            }
        }

        return this._createSourceMap(mapPath, pathToGenerated).then(map => {
            if (!map) {
                const mapPathNextToSource = pathToGenerated + '.map';
                if (mapPathNextToSource !== mapPath) {
                    return this._createSourceMap(mapPathNextToSource, pathToGenerated);
                }
            }

            return map;
        }).then(map => {
            if (map) {
                this._generatedToSourceMaps[pathToGenerated] = map;
            }

            return map || null;
        });
    }

    private _createSourceMap(mapPath: string, pathToGenerated: string): Promise<SourceMap> {
        let contentsP: Promise<string>;
        if (utils.isURL(mapPath)) {
            logger.log(`SourceMaps.createSourceMap: Downloading sourcemap file from ${mapPath}`);
            contentsP = utils.getURL(mapPath).catch(e => {
                logger.log(`SourceMaps.createSourceMap: Could not download map from ${mapPath}`);
                return null;
            });
        } else {
            contentsP = new Promise((resolve, reject) => {
                logger.log(`SourceMaps.createSourceMap: Reading local sourcemap file from ${mapPath}`);
                fs.readFile(mapPath, (err, data) => {
                    if (err) {
                        logger.log(`SourceMaps.createSourceMap: Could not read map from ${mapPath}`);
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
