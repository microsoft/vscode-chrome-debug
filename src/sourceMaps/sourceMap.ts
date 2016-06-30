/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {SourceMapConsumer, MappedPosition} from 'source-map';
import * as path from 'path';

import * as sourceMapUtils from './sourceMapUtils';
import * as utils from '../utils';
import * as logger from '../logger';

export {MappedPosition};

const WEBPACK_SOURCE_PREFIX = 'webpack:///';

export interface ISourceMap {
    version: string;
    sources: string[];
    names: string[];
    mappings: string;
    file?: string;
    sourcesContent?: string[];
    sourceRoot?: string;
}

export class SourceMap {
    private _generatedPath: string; // the generated file for this sourcemap (absolute path)
    private _sources: string[]; // list of authored files (absolute paths)
    private _smc: SourceMapConsumer; // the source map
    private _authoredPathCaseMap = new Map<string, string>(); // Maintain pathCase map because VSCode is case sensitive

    /**
     * pathToGenerated - an absolute local path or a URL
     * json - sourcemap contents
     * webRoot - an absolute path
     */
    public constructor(generatedPath: string, json: string, webRoot: string) {
        this._generatedPath = generatedPath;

        const sm: ISourceMap = JSON.parse(json);
        logger.log(`SourceMap: creating for ${generatedPath}`);
        logger.log(`SourceMap: sourceRoot: ${sm.sourceRoot}`);
        if (sm.sourceRoot && sm.sourceRoot.toLowerCase() === '/source/') {
            logger.log('Warning: if you are using gulp-sourcemaps < 2.0 directly or indirectly, you may need to set sourceRoot manually in your build config, if your files are not actually under a directory called /source');
        }
        logger.log(`SourceMap: sources: ${JSON.stringify(sm.sources)}`);
        if (sm.sourcesContent && sm.sourcesContent.length) {
            logger.log(`Warning: SourceMap sources are inlined. This extension ignores inlined sources. If the paths are not correct, sourcemap support won't work.`);
        }
        logger.log(`SourceMap: webRoot: ${webRoot}`);

        const absSourceRoot = sourceMapUtils.getAbsSourceRoot(sm.sourceRoot, webRoot, this._generatedPath);

        // Overwrite the sourcemap's sourceRoot with the version that's resolved to an absolute path,
        // so the work above only has to be done once
        const originalSourceRoot = sm.sourceRoot;
        sm.sourceRoot = null;

        // sm.sources are relative paths or file:/// urls - (or other URLs?) read the spec...
        // resolve them to file:/// urls, using absSourceRoot, to be simpler and unambiguous, since
        // it needs to look them up later in exactly the same format.
        // note - the source-map library doesn't like backslashes, but some tools output them.
        // Which is wrong? Consider filing issues on source-map or tools that output backslashes?
        // In either case, support whatever works
        this._sources = sm.sources.map((sourcePath: string) => {
            // Special-case webpack:/// prefixed sources which is kind of meaningless
            let isWebpackURL = false;
            if (sourcePath.startsWith(WEBPACK_SOURCE_PREFIX)) {
                sourcePath = utils.lstrip(sourcePath, WEBPACK_SOURCE_PREFIX);
                isWebpackURL = true;
            }

            sourcePath = utils.canonicalizeUrl(sourcePath);

            // If not already an absolute path, make it an absolute path
            if (!path.isAbsolute(sourcePath)) {
                if (isWebpackURL && !originalSourceRoot) {
                    // By default, webpack produces paths that are relative to the project root. So this is more likely to be right.
                    // And I don't think it's normally possible to set the sourceRoot in webpack, but if someone manages to do it, use that.
                    sourcePath = path.resolve(webRoot, sourcePath);
                } else {
                    sourcePath = path.resolve(absSourceRoot, sourcePath);
                }
            }

            return sourcePath;
        });

        // Rewrite sm.sources to same as this._sources but forward slashes and file url
        sm.sources = this._sources.map(sourceAbsPath => {
            // Convert to file:/// url. After this, it's a file URL for an absolute path to a file on disk with forward slashes.
            // We lowercase so authored <-> generated mapping is not case sensitive.
            const lowerCaseSourceAbsPath = sourceAbsPath.toLowerCase();
            this._authoredPathCaseMap.set(lowerCaseSourceAbsPath, sourceAbsPath);
            return utils.pathToFileURL(lowerCaseSourceAbsPath);
        });

        this._smc = new SourceMapConsumer(sm);
    }

    /*
     * Return all mapped sources as absolute paths
     */
    public get authoredSources(): string[] {
        return this._sources;
    }

    /*
     * The generated file of this source map.
     */
    public generatedPath(): string {
        return this._generatedPath;
    }

    /*
     * Returns true if this source map originates from the given source.
     */
    public doesOriginateFrom(absPath: string): boolean {
        return this.authoredSources.some(path => path === absPath);
    }

    /*
     * Finds the nearest source location for the given location in the generated file.
     * Will return null instead of a mapping on the next line (different from generatedPositionFor).
     */
    public authoredPositionFor(line: number, column: number): MappedPosition {
        // source-map lib uses 1-indexed lines.
        line++;

        const lookupArgs = {
            line,
            column,
            bias: SourceMapConsumer.LEAST_UPPER_BOUND
        };

        let position = this._smc.originalPositionFor(lookupArgs);
        if (!position.source) {
            // If it can't find a match, it returns a mapping with null props. Try looking the other direction.
            lookupArgs.bias = SourceMapConsumer.GREATEST_LOWER_BOUND;
            position = this._smc.originalPositionFor(lookupArgs);
        }

        if (position.source) {
            // file:/// -> absolute path
            position.source = utils.canonicalizeUrl(position.source);

            // Convert back to original case
            position.source = this._authoredPathCaseMap.get(position.source) || position.source;

            // Back to 0-indexed lines
            position.line--;

            return position;
        } else {
            return null;
        }
    }

    /*
     * Finds the nearest location in the generated file for the given source location.
     * Will return a mapping on the next line, if there is no subsequent mapping on the expected line.
     */
    public generatedPositionFor(source: string, line: number, column: number): MappedPosition {
        // source-map lib uses 1-indexed lines.
        line++;

        // sources in the sourcemap have been forced to file:///
        // Convert to lowerCase so search is case insensitive
        source = utils.pathToFileURL(source.toLowerCase());

        const lookupArgs = {
            line,
            column,
            source,
            bias: SourceMapConsumer.LEAST_UPPER_BOUND
        };

        let position = this._smc.generatedPositionFor(lookupArgs);
        if (position.line === null) {
            // If it can't find a match, it returns a mapping with null props. Try looking the other direction.
            lookupArgs.bias = SourceMapConsumer.GREATEST_LOWER_BOUND;
            position = this._smc.generatedPositionFor(lookupArgs);
        }

        if (position.line === null) {
            return null;
        } else {
            return {
                line: position.line - 1, // Back to 0-indexed lines
                column: position.column,
                source: this._generatedPath
            };
        }
    }
}
