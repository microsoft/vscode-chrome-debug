/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as Path from 'path';
import * as URL from 'url';
import * as FS from 'fs';
import {SourceMapConsumer} from 'source-map';
import * as PathUtils from './pathUtilities';
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
    ProcessNewSourceMap(path: string, sourceMapURL: string): void;
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
		const map = this._findGeneratedToSourceMapping(pathToGenerated);
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
        const map = this._findGeneratedToSourceMapping(pathToGenerated);
		return map ? map.sources : null;
    }

    public ProcessNewSourceMap(pathToGenerated: string, sourceMapURL: string): void {
        this._findGeneratedToSourceMapping(pathToGenerated, sourceMapURL);
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

	private _findGeneratedToSourceMapping(pathToGenerated: string, map_path?: string): SourceMap {

		if (pathToGenerated) {

			if (pathToGenerated in this._generatedToSourceMaps) {
				return this._generatedToSourceMaps[pathToGenerated];
			}

			let map: SourceMap = null;

            if (!map_path) {
                // try to find a source map URL in the generated source
                map_path = this._findSourceMapInGeneratedSource(pathToGenerated);
            }

            if (map_path) {
                if (map_path.indexOf("data:application/json;base64,") >= 0) {
                    const pos = map_path.indexOf(',');
                    if (pos > 0) {
                        const data = map_path.substr(pos+1);
                        try {
                            const buffer = new Buffer(data, 'base64');
                            const json = buffer.toString();
                            if (json) {
                                map = new SourceMap(pathToGenerated, json, this._webRoot);
                                this._generatedToSourceMaps[pathToGenerated] = map;
                                return map;
                            }
                        }
                        catch (e) {
                            Logger.log(`FindGeneratedToSourceMapping: exception while processing data url (${e})`);
                        }
                    }
                } else {
                    map_path = map_path;
                }
            }

			// if path is relative make it absolute
            if (map_path && !Path.isAbsolute(map_path)) {
 				map_path = PathUtils.makePathAbsolute(pathToGenerated, map_path);
            }

			if (map_path === null || !FS.existsSync(map_path)) {
				// try to find map file next to the generated source
				map_path = pathToGenerated + ".map";
			}

			if (FS.existsSync(map_path)) {
				map = this._createSourceMap(map_path, pathToGenerated);
				if (map) {
					this._generatedToSourceMaps[pathToGenerated] = map;
					return map;
				}
			}
		}
		return null;
	}

	private _createSourceMap(map_path: string, path: string): SourceMap {
		try {
			const contents = FS.readFileSync(Path.join(map_path)).toString();
			return new SourceMap(path, contents, this._webRoot);
		}
		catch (e) {
			console.error(`CreateSourceMap: {e}`);
		}
		return null;
	}

	//  find "//# sourceMappingURL=<url>"
	private _findSourceMapInGeneratedSource(pathToGenerated: string): string {

		try {
			// TODO@AW better read lines...
			const contents = FS.readFileSync(pathToGenerated).toString();
			const lines = contents.split('\n');
			for (let line of lines) {
				const matches = SourceMaps.SOURCE_MAPPING_MATCHER.exec(line);
				if (matches && matches.length === 2) {
					const uri = matches[1].trim();
					return uri;
				}
			}
		} catch (e) {
			// ignore exception
		}
		return null;
	}
}

enum Bias {
	GREATEST_LOWER_BOUND = 1,
	LEAST_UPPER_BOUND = 2
}

class SourceMap {

	private _generatedFile: string;		// the generated file for this sourcemap
	private _sources: string[];			// the sources of generated file (relative to sourceRoot)
	private _absSourceRoot: string;		// the common prefix for the source (can be a URL)
	private _smc: SourceMapConsumer;	// the source map
    private _webRoot: string;           // if the sourceRoot starts with /, it's resolved from this absolute path


	public constructor(generatedPath: string, json: string, webRoot: string) {
        Logger.log(`SourceMap: creating SM for ${generatedPath}`)
		this._generatedFile = generatedPath;
        this._webRoot = webRoot;

		const sm = JSON.parse(json);
		let sr = <string> sm.sourceRoot;
		if (sr) {
            if (URL.parse(sr).protocol === 'file:') {
                // sourceRoot points to a local path like "file:///c:/project/src"
                this._absSourceRoot = PathUtils.canonicalizeUrl(sr);
            } else if (Path.isAbsolute(sr)) {
                // like "/src", would be like http://localhost/src, resolve to a local path under webRoot
                this._absSourceRoot = Path.join(this._webRoot, sr);
            } else {
                // like "src" or "../src", relative to the script
                this._absSourceRoot = PathUtils.makePathAbsolute(generatedPath, sr);
            }

            Logger.log(`SourceMap: resolved sourceRoot ${sr} -> ${this._absSourceRoot}`);
		} else {
			this._absSourceRoot = Path.dirname(generatedPath);
            Logger.log(`SourceMap: no sourceRoot specified, using script dirname: ${this._absSourceRoot}`);
		}

        // Strip trailing /
        if (this._absSourceRoot[this._absSourceRoot.length - 1] === Path.sep) {
            this._absSourceRoot = this._absSourceRoot.substr(0, this._absSourceRoot.length - 1);
        }

        // Overwrite the sourcemap's sourceRoot with the version that's resolved to an absolute path,
        // so the work above only has to be done once
        sm.sourceRoot = 'file:///' + this._absSourceRoot;
		this._smc = new SourceMapConsumer(sm);

        // rewrite sources as absolute paths
        this._sources = sm.sources.map(sourcePath => {
            sourcePath = PathUtils.canonicalizeUrl(sourcePath);
            return Path.isAbsolute(sourcePath) ?
                sourcePath :
                Path.resolve(this._absSourceRoot, sourcePath);
        });
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
		return this._generatedFile;
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

		// make input path relative to sourceRoot
		if (this._absSourceRoot) {
			src = Path.relative(this._absSourceRoot, src);
		}

		// source-maps always use forward slashes
		if (process.platform === 'win32') {
			src = src.replace(/\\/g, '/');
		}

		const needle = {
			source: src,
			line: line,
			column: column,
			bias: bias
		};

		return this._smc.generatedPositionFor(needle);
	}
}
