/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as MozSourceMap from 'source-map';

import * as testUtils from '../testUtils';

import {SourceMap} from '../../src/sourceMaps/sourceMap';

/**
 * Unit tests for SourceMap + source-map (the mozilla lib). source-map is included in the test and not mocked
 */
suite('SourceMap', () => {
    const GENERATED_PATH = testUtils.pathResolve('/project/src/app.js');
    const WEBROOT = testUtils.pathResolve('/project');
    const SOURCEROOT = '/src';

    const SOURCES = [
        'source1.ts',
        'source2.ts'
    ];
    const ABSOLUTE_SOURCES = SOURCES.map(source => {
        // Join the path segments, then resolve to force proper slashes
        return testUtils.pathResolve(
            path.join(WEBROOT, SOURCEROOT, source));
    });

    // Load out.js.map, which should be copied to this folder under 'out' by the build process
    const SOURCEMAP_MAPPINGS_JSON = fs.readFileSync(
        path.resolve(__dirname, 'testData/app.js.map')
    ).toString();

    setup(() => {
        testUtils.setupUnhandledRejectionListener();
    });

    teardown(() => {
        testUtils.removeUnhandledRejectionListener();
    });

    suite('constructor', () => {
        test('does not crash when sourceRoot is undefined', () => {
            // Rare and possibly invalid, but I saw it
            const sourceMapJSON = getMockSourceMapJSON(SOURCES, undefined);
            const sm = new SourceMap(GENERATED_PATH, sourceMapJSON, WEBROOT);
            assert(sm);
        });
    });

    suite('.sources', () => {
        test('relative sources are made absolute', () => {
            const sourceMapJSON = getMockSourceMapJSON(SOURCES, SOURCEROOT);

            const sm = new SourceMap(GENERATED_PATH, sourceMapJSON, WEBROOT);
            assert.deepEqual(sm.authoredSources, ABSOLUTE_SOURCES);
        });

        test('sources with absolute paths are used as-is', () => {
            const sourceMapJSON = getMockSourceMapJSON(ABSOLUTE_SOURCES, SOURCEROOT);

            const sm = new SourceMap(GENERATED_PATH, sourceMapJSON, WEBROOT);
            assert.deepEqual(sm.authoredSources, ABSOLUTE_SOURCES);
        });

        test('file:/// sources are exposed as absolute paths', () => {
            const fileSources = ABSOLUTE_SOURCES.map(source => 'file:///' + source);
            const sourceMapJSON = getMockSourceMapJSON(fileSources, SOURCEROOT);

            const sm = new SourceMap(GENERATED_PATH, sourceMapJSON, WEBROOT);
            assert.deepEqual(sm.authoredSources, ABSOLUTE_SOURCES);
        });
    });

    suite('doesOriginateFrom', () => {
        test('returns true for a source that it contains', () => {
            const sourceMapJSON = getMockSourceMapJSON(ABSOLUTE_SOURCES, SOURCEROOT);

            const sm = new SourceMap(GENERATED_PATH, sourceMapJSON, WEBROOT);
            assert(sm.doesOriginateFrom(ABSOLUTE_SOURCES[0]));
        });

        test('returns false for a source that it does not contain', () => {
            const sourceMapJSON = getMockSourceMapJSON(ABSOLUTE_SOURCES, SOURCEROOT);

            const sm = new SourceMap(GENERATED_PATH, sourceMapJSON, WEBROOT);
            assert(!sm.doesOriginateFrom('c:\\fake\\file.js'));
        });
    });

    suite('originalPositionFor', () => {
        let sm: SourceMap;

        setup(() => {
            sm = new SourceMap(GENERATED_PATH, SOURCEMAP_MAPPINGS_JSON, WEBROOT);
        });

        function getExpectedResult(line: number, column: number, source = ABSOLUTE_SOURCES[0]): MozSourceMap.MappedPosition {
            return {
                line,
                column,
                name: null,
                source
            };
        }

        test('return statement', () => {
            assert.deepEqual(
                sm.authoredPositionFor(/*line=*/11, /*column=*/0),
                getExpectedResult(/*line=*/13, /*column=*/8));

            assert.deepEqual(
                sm.authoredPositionFor(/*line=*/11, /*column=*/8),
                getExpectedResult(/*line=*/13, /*column=*/8));

            assert.deepEqual(
                sm.authoredPositionFor(/*line=*/11, /*column=*/17),
                getExpectedResult(/*line=*/13, /*column=*/17));
        });

        test('first line of a method', () => {
            // 'let x = ...'
            assert.deepEqual(
                sm.authoredPositionFor(/*line=*/9, /*column=*/0),
                getExpectedResult(/*line=*/11, /*column=*/8));

            assert.deepEqual(
                sm.authoredPositionFor(/*line=*/9, /*column=*/8),
                getExpectedResult(/*line=*/11, /*column=*/8));

            assert.deepEqual(
                sm.authoredPositionFor(/*line=*/9, /*column=*/9),
                getExpectedResult(/*line=*/11, /*column=*/12));
        });

        test('private field initializer', () => {
            // 'private _x = ...'
            assert.deepEqual(
                sm.authoredPositionFor(/*line=*/5, /*column=*/0),
                getExpectedResult(/*line=*/4, /*column=*/12));

            assert.deepEqual(
                sm.authoredPositionFor(/*line=*/5, /*column=*/4),
                getExpectedResult(/*line=*/4, /*column=*/12));

            assert.deepEqual(
                sm.authoredPositionFor(/*line=*/5, /*column=*/17),
                getExpectedResult(/*line=*/4, /*column=*/25));
        });

        test('first line of file', () => {
            const expected = getExpectedResult(/*line=*/0, /*column=*/0, ABSOLUTE_SOURCES[1]);

            // 'function f() { ...'
            assert.deepEqual(
                sm.authoredPositionFor(/*line=*/18, /*column=*/0),
                expected);

            assert.deepEqual(
                sm.authoredPositionFor(/*line=*/18, /*column=*/9),
                expected);

            assert.deepEqual(
                sm.authoredPositionFor(/*line=*/18, /*column=*/14),
                expected);
        });

        test('last line of file', () => {
            // 'f();'
            assert.deepEqual(
                sm.authoredPositionFor(/*line=*/22, /*column=*/0),
                getExpectedResult(/*line=*/5, /*column=*/0, ABSOLUTE_SOURCES[1]));

            assert.deepEqual(
                sm.authoredPositionFor(/*line=*/22, /*column=*/1),
                getExpectedResult(/*line=*/5, /*column=*/1, ABSOLUTE_SOURCES[1]));

            assert.deepEqual(
                sm.authoredPositionFor(/*line=*/22, /*column=*/5),
                getExpectedResult(/*line=*/5, /*column=*/4, ABSOLUTE_SOURCES[1]));
        });

        test('return null when there is no matching mapping', () => {
            assert.deepEqual(
                sm.authoredPositionFor(/*line=*/1000, /*column=*/0),
                null);
        });
    });

    suite('generatedPositionFor', () => {
        let sm: SourceMap;

        setup(() => {
            sm = new SourceMap(GENERATED_PATH, SOURCEMAP_MAPPINGS_JSON, WEBROOT);
        });

        function getExpectedResult(line: number, column: number): MozSourceMap.Position {
            return <any>{
                line,
                column,
                source: GENERATED_PATH
            };
        }

        test('return statement', () => {
            assert.deepEqual(
                sm.generatedPositionFor(ABSOLUTE_SOURCES[0], /*line=*/13, /*column=*/0),
                getExpectedResult(/*line=*/11, /*column=*/8));

            assert.deepEqual(
                sm.generatedPositionFor(ABSOLUTE_SOURCES[0], /*line=*/13, /*column=*/8),
                getExpectedResult(/*line=*/11, /*column=*/8));

            assert.deepEqual(
                sm.generatedPositionFor(ABSOLUTE_SOURCES[0], /*line=*/13, /*column=*/17),
                getExpectedResult(/*line=*/11, /*column=*/17));
        });

        test('first line of a method', () => {
            // 'let x = ...'
            assert.deepEqual(
                sm.generatedPositionFor(ABSOLUTE_SOURCES[0], /*line=*/11, /*column=*/0),
                getExpectedResult(/*line=*/9, /*column=*/8));

            assert.deepEqual(
                sm.generatedPositionFor(ABSOLUTE_SOURCES[0], /*line=*/11, /*column=*/8),
                getExpectedResult(/*line=*/9, /*column=*/8));

            assert.deepEqual(
                sm.generatedPositionFor(ABSOLUTE_SOURCES[0], /*line=*/11, /*column=*/19),
                getExpectedResult(/*line=*/9, /*column=*/20));
        });

        test('private field initializer', () => {
            // 'private _x = ...'
            assert.deepEqual(
                sm.generatedPositionFor(ABSOLUTE_SOURCES[0], /*line=*/4, /*column=*/0),
                getExpectedResult(/*line=*/5, /*column=*/8));

            assert.deepEqual(
                sm.generatedPositionFor(ABSOLUTE_SOURCES[0], /*line=*/4, /*column=*/4),
                getExpectedResult(/*line=*/5, /*column=*/8));

            assert.deepEqual(
                sm.generatedPositionFor(ABSOLUTE_SOURCES[0], /*line=*/4, /*column=*/20),
                getExpectedResult(/*line=*/5, /*column=*/18));
        });

        test('first line of file', () => {
            // 'function f() { ...'
            assert.deepEqual(
                sm.generatedPositionFor(ABSOLUTE_SOURCES[1], /*line=*/0, /*column=*/0),
                getExpectedResult(/*line=*/18, /*column=*/0));

            // This line only has one mapping, so a non-0 column ends up mapped to the next line.
            // I think this needs a fix but at the moment there is no scenario where this is called with
            // a non-0 column.
            assert.deepEqual(
                sm.generatedPositionFor(ABSOLUTE_SOURCES[1], /*line=*/0, /*column=*/1),
                getExpectedResult(/*line=*/19, /*column=*/4));

            assert.deepEqual(
                sm.generatedPositionFor(ABSOLUTE_SOURCES[1], /*line=*/0, /*column=*/14),
                getExpectedResult(/*line=*/19, /*column=*/4));
        });

        test('last line of file', () => {
            // 'f();'
            assert.deepEqual(
                sm.generatedPositionFor(ABSOLUTE_SOURCES[1], /*line=*/5, /*column=*/0),
                getExpectedResult(/*line=*/22, /*column=*/0));

            assert.deepEqual(
                sm.generatedPositionFor(ABSOLUTE_SOURCES[1], /*line=*/5, /*column=*/1),
                getExpectedResult(/*line=*/22, /*column=*/1));

            assert.deepEqual(
                sm.generatedPositionFor(ABSOLUTE_SOURCES[1], /*line=*/5, /*column=*/5),
                getExpectedResult(/*line=*/22, /*column=*/4));
        });

        // Discrepency with originalPositionFor bc that's the way the source-map lib works.
        // Not sure whether there's a good reason for that.
        test('returns the last mapping when there is no matching mapping', () => {
            assert.deepEqual(
                sm.generatedPositionFor(ABSOLUTE_SOURCES[0], /*line=*/1000, /*column=*/0),
                getExpectedResult(/*line=*/17, /*column=*/1));
        });
    });
});

function getMockSourceMapJSON(sources: string[], sourceRoot?: string): string {
    return JSON.stringify({
        sources,
        sourceRoot,
        version: 3,
        mappings: []
    });
}
