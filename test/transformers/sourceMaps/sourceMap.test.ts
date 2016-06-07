/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from 'assert';
import * as path from 'path';

import * as testUtils from '../../testUtils';

import {SourceMap} from '../../../src/transformers/sourceMaps/sourceMap';

/**
 * Unit tests for SourceMap + source-map (the mozilla lib). source-map is included in the test and not mocked
 */
suite('SourceMap', () => {
    const GENERATED_PATH = 'c:\\project\\src\\app.js';
    const WEBROOT = 'c:\\project';
    const SOURCEROOT = 'c:\\project\\src';

    const SOURCES = [
        'sourcefile1.ts',
        'sourcefile2.ts'
    ];
    const ABSOLUTE_SOURCES = SOURCES.map(source => path.resolve(SOURCEROOT, source));

    setup(() => {
        testUtils.registerWin32Mocks();
        testUtils.setupUnhandledRejectionListener();
    });

    teardown(() => {
        testUtils.removeUnhandledRejectionListener();
    });

    suite('.sources', () => {
        test('relative sources are made absolute', () => {
            const sourceMapJSON = getMockSourceMapJSON(SOURCES, SOURCEROOT);

            const sm = new SourceMap(GENERATED_PATH, sourceMapJSON, WEBROOT);
            assert.deepEqual(sm.sources, ABSOLUTE_SOURCES);
        });

        test('sources with absolute paths are used as-is', () => {
            const sourceMapJSON = getMockSourceMapJSON(ABSOLUTE_SOURCES, SOURCEROOT);

            const sm = new SourceMap(GENERATED_PATH, sourceMapJSON, WEBROOT);
            assert.deepEqual(sm.sources, ABSOLUTE_SOURCES);
        });

        test('file:/// sources are exposed as absolute paths', () => {
            const fileSources = ABSOLUTE_SOURCES.map(source => 'file:///' + source);
            const sourceMapJSON = getMockSourceMapJSON(fileSources, SOURCEROOT);

            const sm = new SourceMap(GENERATED_PATH, sourceMapJSON, WEBROOT);
            assert.deepEqual(sm.sources, ABSOLUTE_SOURCES);
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

    });

    suite('generatedPositionFor', () => {

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
