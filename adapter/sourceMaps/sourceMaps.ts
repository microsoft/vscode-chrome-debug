/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

 /* tslint:disable */

import * as Path from 'path';
import * as URL from 'url';
import * as FS from 'fs';
import {SourceMapConsumer} from 'source-map';
import * as PathUtils from './pathUtilities';
import * as utils from '../../webkit/utilities';
import {Logger} from '../../webkit/utilities';


export interface MappingResult {
	path: string;
	line: number;
	column: number;
}

export interface ISourceMaps {
	/*
	 * Map source language path to generated path.
	 * Returns null if not found.
	 */
	MapPathFromSource(path: string): string;

	/*
	 * Map location in source language to location in generated code.
	 * line and column are 0 based.
	 */
	MapFromSource(path: string, line: number, column: number): MappingResult;

	/*
	 * Map location in generated code to location in source language.
	 * line and column are 0 based.
	 */
	MapToSource(path: string, line: number, column: number): MappingResult;

    /*
     * Get all the sources that map to this generated file
     */
    AllMappedSources(path: string): string[];

    /**
     * With a known sourceMapURL for a generated script, process create the SourceMap and cache for later
     */
    ProcessNewSourceMap(path: string, sourceMapURL: string): Promise<void>;
}


export class SourceMaps implements ISourceMaps {

	public static TRACE = false;

	private static SOURCE_MAPPING_MATCHER = new RegExp("//[#@] ?sourceMappingURL=(.+)$");

	private _generatedToSourceMaps:  { [id: string] : SourceMap; } = {};		// generated -> source file
	private _sourceToGeneratedMaps:  { [id: string] : SourceMap; } = {};		// source file -> generated

    /* Path to resolve / paths against */
    private _webRoot: string;

	public constructor(webRoot: string) {
        this._webRoot = webRoot;
	}

	public MapPathFromSource(pathToSource: string): string {
		var map = this._findSourceToGeneratedMapping(pathToSource);
		if (map)
			return map.generatedPath();
		return null;;
	}

	public MapFromSource(pathToSource: string, line: number, column: number): MappingResult {
		const map = this._findSourceToGeneratedMapping(pathToSource);
		if (map) {
			line += 1;	// source map impl is 1 based
			const mr = map.generatedPositionFor(pathToSource, line, column);
			if (typeof mr.line === 'number') {
				if (SourceMaps.TRACE) console.error(`${Path.basename(pathToSource)} ${line}:${column} -> ${mr.line}:${mr.column}`);
				return { path: map.generatedPath(), line: mr.line-1, column: mr.column};
			}
		}
		return null;
	}

	public MapToSource(pathToGenerated: string, line: number, column: number): MappingResult {
		const map = this._generatedToSourceMaps[pathToGenerated];
		if (map) {
			line += 1;	// source map impl is 1 based
			const mr = map.originalPositionFor(line, column);
			if (mr.source) {
				if (SourceMaps.TRACE) console.error(`${Path.basename(pathToGenerated)} ${line}:${column} -> ${mr.line}:${mr.column}`);
				return { path: mr.source, line: mr.line-1, column: mr.column};
			}
		}
		return null;
	}

    public AllMappedSources(pathToGenerated: string): string[] {
        const map = this._generatedToSourceMaps[pathToGenerated];
		return map ? map.sources : null;
    }

    public ProcessNewSourceMap(pathToGenerated: string, sourceMapURL: string): Promise<void> {
        return this._findGeneratedToSourceMapping(pathToGenerated, sourceMapURL).then(() => { });
    }

	//---- private -----------------------------------------------------------------------

	private _findSourceToGeneratedMapping(pathToSource: string): SourceMap {

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

            // not found in existing maps
		}
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

        if (mapPath.indexOf("data:application/json") >= 0) {
            Logger.log(`SourceMaps.findGeneratedToSourceMapping: Using inlined sourcemap in ${pathToGenerated}`);

            // sourcemap is inlined
            const pos = mapPath.lastIndexOf(',');
            const data = mapPath.substr(pos+1);
            try {
                const buffer = new Buffer(data, 'base64');
                const json = buffer.toString();
                if (json) {
                    const map = new SourceMap(pathToGenerated, json, this._webRoot);
                    this._generatedToSourceMaps[pathToGenerated] = map;
                    return Promise.resolve(map);
                }
            }
            catch (e) {
                Logger.log(`SourceMaps.findGeneratedToSourceMapping: exception while processing data url (${e.stack})`);
            }

            return null;
        }

        // if path is relative make it absolute
        if (!Path.isAbsolute(mapPath)) {
            if (Path.isAbsolute(pathToGenerated)) {
                // runtime script is on disk, so map should be too
                mapPath = PathUtils.makePathAbsolute(pathToGenerated, mapPath);
            } else {
                // runtime script is not on disk, construct the full url for the source map
                const scriptUrl = URL.parse(pathToGenerated);
                mapPath = `${scriptUrl.protocol}//${scriptUrl.host}${Path.dirname(scriptUrl.pathname)}/${mapPath}`;
            }
        }

        return this._createSourceMap(mapPath, pathToGenerated).then(map => {
            if (!map) {
                const mapPathNextToSource = pathToGenerated + ".map";
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
            Logger.log(`SourceMaps.createSourceMap: Downloading sourcemap file from ${mapPath}`);
            contentsP = utils.getURL(mapPath).catch(e => {
                Logger.log(`SourceMaps.createSourceMap: Could not download map from ${mapPath}`);
                return null;
            });
        } else {
            contentsP = new Promise((resolve, reject) => {
                Logger.log(`SourceMaps.createSourceMap: Reading local sourcemap file from ${mapPath}`);
                FS.readFile(mapPath, (err, data) => {
                    if (err) {
                        Logger.log(`SourceMaps.createSourceMap: Could not read map from ${mapPath}`);
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
                    Logger.log(`SourceMaps.createSourceMap: exception while processing sourcemap: ${e.stack}`);
                    return null;
                }
            } else {
                return null;
            }
        });
	}
}

enum Bias {
	GREATEST_LOWER_BOUND = 1,
	LEAST_UPPER_BOUND = 2
}

class SourceMap {
	private _generatedPath: string;		// the generated file for this sourcemap
	private _sources: string[];			// list of authored files (absolute paths)
	private _smc: SourceMapConsumer;	// the source map

    /**
     * pathToGenerated - an absolute local path or a URL
     * json - sourcemap contents
     * webRoot - an absolute path
     */
	public constructor(generatedPath: string, json: string, webRoot: string) {
        Logger.log(`SourceMap: creating SM for ${generatedPath}`)
		this._generatedPath = generatedPath;

		const sm = JSON.parse(json);
		const absSourceRoot = PathUtils.getAbsSourceRoot(sm.sourceRoot, webRoot, this._generatedPath);

        // Overwrite the sourcemap's sourceRoot with the version that's resolved to an absolute path,
        // so the work above only has to be done once
        sm.sourceRoot = null; // probably get rid of this._sourceRoot?

        // sm.sources are relative paths or file:/// urls - (or other URLs?) read the spec...
        // resolve them to file:/// urls, using absSourceRoot.
        // note - the source-map library doesn't like backslashes, but some tools output them.
        // Which is wrong? Consider filing issues on source-map or tools that output backslashes?
        // In either case, support whatever works
        this._sources = sm.sources.map((sourcePath: string) => {
            // Special-case webpack:/// prefixed sources which is kind of meaningless
            sourcePath = utils.lstrip(sourcePath, 'webpack:///');
            sourcePath = utils.canonicalizeUrl(sourcePath);

            // If not already an absolute path, make it an absolute path with this._absSourceRoot. Also resolves '..' parts.
            if (!Path.isAbsolute(sourcePath)) {
                sourcePath = Path.resolve(absSourceRoot, sourcePath);
            }

            return sourcePath;
        });

        // Rewrite sm.sources to same as this._sources but forward slashes and file url
        sm.sources = this._sources.map(sourceAbsPath => {
            // Convert to file: url. After this, it's a file URL for an absolute path to a file on disk with forward slashes.
            return utils.pathToFileURL(sourceAbsPath);
        });

        this._smc = new SourceMapConsumer(sm);
	}

    /*
     * Return all mapped sources as absolute paths
     */
    public get sources(): string[] {
        return this._sources;
    }

	/*
	 * the generated file of this source map.
	 */
	public generatedPath(): string {
		return this._generatedPath;
	}

	/*
	 * returns true if this source map originates from the given source.
	 */
	public doesOriginateFrom(absPath: string): boolean {
		return this.sources.some(path => path === absPath);
	}

	/*
	 * finds the nearest source location for the given location in the generated file.
	 */
	public originalPositionFor(line: number, column: number, bias: Bias = Bias.GREATEST_LOWER_BOUND): SourceMap.MappedPosition {
		const mp = this._smc.originalPositionFor(<any>{
			line: line,
			column: column,
			bias: bias
		});

		if (mp.source) {
			mp.source = PathUtils.canonicalizeUrl(mp.source);
		}

		return mp;
	}

	/*
	 * finds the nearest location in the generated file for the given source location.
	 */
	public generatedPositionFor(src: string, line: number, column: number, bias = Bias.GREATEST_LOWER_BOUND): SourceMap.Position {
        src = utils.pathToFileURL(src);

		const needle = {
			source: src,
			line: line,
			column: column,
			bias: bias
		};
		return this._smc.generatedPositionFor(needle);
	}
}
