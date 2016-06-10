/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {SourceMap, MappedPosition} from './sourceMap';

import {getMapForGeneratedPath} from './sourceMapFactory';

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
        return this._authoredPathToSourceMap.has(authoredPath) ?
            this._authoredPathToSourceMap.get(authoredPath).generatedPath() :
            null;
    }

    public mapToGenerated(authoredPath: string, line: number, column: number): MappedPosition {
        return this._authoredPathToSourceMap.has(authoredPath) ?
            this._authoredPathToSourceMap.get(authoredPath)
                .generatedPositionFor(authoredPath, line, column) :
            null;
    }

    public mapToAuthored(pathToGenerated: string, line: number, column: number): MappedPosition {
        return this._generatedPathToSourceMap.has(pathToGenerated) ?
            this._generatedPathToSourceMap.get(pathToGenerated)
                .authoredPositionFor(line, column) :
            null;
    }

    public allMappedSources(pathToGenerated: string): string[] {
        return this._generatedPathToSourceMap.has(pathToGenerated) ?
            this._generatedPathToSourceMap.get(pathToGenerated).authoredSources :
            null;
    }

    /**
     * Given a new path to a new script file, finds and loads the sourcemap for that file
     */
    public processNewSourceMap(pathToGenerated: string, sourceMapURL: string): Promise<void> {
        return this._generatedPathToSourceMap.has(pathToGenerated) ?
            Promise.resolve(null) :
            getMapForGeneratedPath(pathToGenerated, sourceMapURL, this._webRoot).then(sourceMap => {
                this._generatedPathToSourceMap.set(pathToGenerated, sourceMap);
                sourceMap.authoredSources.forEach(authoredSource => this._authoredPathToSourceMap.set(authoredSource, sourceMap));
            });
    }
}
