/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as path from 'path';
import * as fs from 'fs';

const globby = require('globby');

import {LazySourceMapTransformer} from './lazySourceMapTransformer';

import {ISetBreakpointsArgs, ILaunchRequestArgs, IAttachRequestArgs,
    ISetBreakpointsResponseBody, IStackTraceResponseBody, ISourceMapPathOverrides} from '../debugAdapterInterfaces';
import {SourceMaps} from '../sourceMaps/sourceMaps';
import * as utils from '../utils';
import * as logger from '../logger';

export class EagerSourceMapTransformer extends LazySourceMapTransformer {
	private _preLoad: Promise<void>;

    protected init(args: ILaunchRequestArgs | IAttachRequestArgs): void {
        const outDirs = args.outDirs ?
			args.outDirs :
			args.outDir ?
				[path.join(args.outDir, '**/*.js')] :
				[];

		this._preLoad = globby(outDirs)
			.then(paths => Promise.all(paths.map(path => this.findSourceMapForFile(path))));
    }

	private findSourceMapForFile(path: string): Promise<void> {

	}

	private

    /**
     * Find the sourcemap and load it, then call super, so it already knows about it.
     */
    public setBreakpoints(args: ISetBreakpointsArgs, requestSeq: number): Promise<void> {
        return super.setBreakpoints(args, requestSeq);
    }

    private discoverAllSourceMaps(): Promise<void> {
        // search for all map files in generatedCodeDirectory
		if (this._generatedCodeDirectory) {
            return this.discoverSourceMapsInDirectory(this._generatedCodeDirectory);
		} else {
            return Promise.resolve<void>();
        }
    }

    private discoverSourceMapsInDirectory(dirPath: string): Promise<void> {
        return utils.fsReadDirP(dirPath).then(files => {
            const maps = files.filter(f => path.extname(f).toLowerCase() === '.map');
            for (let map_name of maps) {
                const map_path = Path.join(this._generatedCodeDirectory, map_name);
                const m = this._loadSourceMap(map_path);
                if (m && m.doesOriginateFrom(pathToSource)) {
                    this._log(`_findSourceToGeneratedMapping: found source map for source ${pathToSource} in outDir`);
                    this._sourceToGeneratedMaps[pathToSourceKey] = m;
                    return Promise.resolve(m);
                }
            }
        },
        err => {
            // Log error and continue
            logger.error('Error finding sourcemap files in outDir: ' + err.message);
        });
    }

    /**
	 * Tries to find a SourceMap for the given source.
	 * This is difficult because the source does not contain any information about where
	 * the generated code or the source map is located.
	 * Our strategy is as follows:
	 * - search in all known source maps whether if refers to this source in the sources array.
	 * - ...
	 */
	private findSourceToGeneratedMapping(pathToSource: string): Promise<SourceMap> {
		if (!pathToSource) {
			return Promise.resolve(null);
		}

		const pathToSourceKey = pathNormalize(pathToSource);

		// try to find in existing
		if (pathToSourceKey in this._sourceToGeneratedMaps) {
			return Promise.resolve(this._sourceToGeneratedMaps[pathToSourceKey]);
		}

		// a reverse lookup: in all source maps try to find pathToSource in the sources array
		for (let key in this._generatedToSourceMaps) {
			const m = this._generatedToSourceMaps[key];
			if (m.doesOriginateFrom(pathToSource)) {
				this._sourceToGeneratedMaps[pathToSourceKey] = m;
				return Promise.resolve(m);
			}
		}

		// no map found

		let pathToGenerated = pathToSource;
		const ext = Path.extname(pathToSource);
		if (ext !== '.js') {
			// use heuristic: change extension to ".js" and find a map for it
			const pos = pathToSource.lastIndexOf('.');
			if (pos >= 0) {
				pathToGenerated = pathToSource.substr(0, pos) + '.js';
			}
		}

		let map: SourceMap = null;

		return Promise.resolve(map).then(map => {

			// first look into the generated code directory
			if (this._generatedCodeDirectory) {
				const promises = new Array<Promise<SourceMap>>();
				let rest = PathUtils.makeRelative(this._generatedCodeDirectory, pathToGenerated);
				while (rest) {
					const path = Path.join(this._generatedCodeDirectory, rest);
					promises.push(this._findGeneratedToSourceMapping(path));
					rest = PathUtils.removeFirstSegment(rest);
				}
				return Promise.all(promises).then(results => {
					for (let r of results) {
						if (r) {
							return r;
						}
					}
					return null;
				});
			}
			return map;

		}).then(map => {

			// VSCode extension host support:
			// we know that the plugin has an "out" directory next to the "src" directory
			if (map === null) {
				let srcSegment = Path.sep + 'src' + Path.sep;
				if (pathToGenerated.indexOf(srcSegment) >= 0) {
					const outSegment = Path.sep + 'out' + Path.sep;
					return this._findGeneratedToSourceMapping(pathToGenerated.replace(srcSegment, outSegment));
				}
			}
			return map;

		}).then(map => {

			if (map === null && pathNormalize(pathToGenerated) !== pathToSourceKey) {
				return this._findGeneratedToSourceMapping(pathToGenerated);
			}
			return map;

		}).then(map => {

			if (map) {
				this._sourceToGeneratedMaps[pathToSourceKey] = map;
			}
			return map;

		});
	}

	private _findSourceMapUrlInFile(pathToGenerated: string, content?: string): Promise<string> {

		if (content) {
			return Promise.resolve(this._findSourceMapUrl(content));
		}

		return this._readFile(pathToGenerated).then(content => {
			return this._findSourceMapUrl(content, pathToGenerated);
		}).catch(err => {
			return null;
		});
	}

	/**
	 * Try to find the 'sourceMappingURL' at the end of the given contents.
	 * Relative file paths are converted into absolute paths.
	 * Returns null if no source map url is found.
	 */
	private _findSourceMapUrl(contents: string, pathToGenerated?: string): string {

		const lines = contents.split('\n');
		for (let l = lines.length-1; l >= Math.max(lines.length-10, 0); l--) {	// only search for url in the last 10 lines
			const line = lines[l].trim();
			const matches = SourceMaps.SOURCE_MAPPING_MATCHER.exec(line);
			if (matches && matches.length === 2) {
				let uri = matches[1].trim();
				if (pathToGenerated) {
					this._log(`_findSourceMapUrl: source map url found at end of generated file '${pathToGenerated}'`);
				} else {
					this._log(`_findSourceMapUrl: source map url found at end of generated content`);
				}

				const u = URL.parse(uri);
				if (u.protocol === 'file:' || u.protocol == null) {

					// a local file path
					let map_path = decodeURI(u.path);

					if (!map_path) {
						throw new Error(`no path or empty path`);
					}

					// if path is relative make it absolute
					if (!Path.isAbsolute(map_path)) {
						if (pathToGenerated) {
							uri = PathUtils.makePathAbsolute(pathToGenerated, map_path);
						} else {
							throw new Error(`relative path but no base given`);
						}
					}
				}
				return uri;
			}
		}
		return null;
	}
}
