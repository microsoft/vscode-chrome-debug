/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from 'assert';
import * as mockery from 'mockery';
import * as testUtils from '../testUtils';
import * as path from 'path';

import {fixDriveLetterAndSlashes} from '../../src/utils';
import {SourceMaps} from '../../src/sourceMaps/sourceMaps';
import {MappedPosition} from '../../src/sourceMaps/sourceMap';

suite('SourceMaps', () => {
    // VSCode expects lowercase windows drive names
    const DIRNAME = fixDriveLetterAndSlashes(__dirname);
    const GENERATED_PATH = path.resolve(DIRNAME, 'testData/app.js');
    const AUTHORED_PATH = path.resolve(DIRNAME, 'testData/source1.ts');
    const ALL_SOURCES = [AUTHORED_PATH, path.resolve(DIRNAME, 'testData/source2.ts')];
    const WEBROOT = 'http://localhost';
    const SOURCEMAP_URL = 'app.js.map';
    const sourceMaps = new SourceMaps(WEBROOT);

    setup((done) => {
        testUtils.setupUnhandledRejectionListener();
        mockery.enable({ warnOnReplace: false, useCleanCache: true, warnOnUnregistered: false });
        testUtils.registerWin32Mocks();
        sourceMaps.processNewSourceMap(GENERATED_PATH, SOURCEMAP_URL).then(done);
    });

    teardown(() => {
        testUtils.removeUnhandledRejectionListener();
        mockery.deregisterAll();
        mockery.disable();
    });

    test('allMappedSources is case insensitive', () => {
        assert.deepEqual(sourceMaps.allMappedSources(GENERATED_PATH.toUpperCase()), ALL_SOURCES);
        assert.deepEqual(sourceMaps.allMappedSources(GENERATED_PATH.toLowerCase()), ALL_SOURCES);
    });

    test('getGeneratedPathFromAuthoredPath is case insensitive', () => {
        assert.equal(sourceMaps.getGeneratedPathFromAuthoredPath(AUTHORED_PATH.toUpperCase()), GENERATED_PATH);
        assert.equal(sourceMaps.getGeneratedPathFromAuthoredPath(AUTHORED_PATH.toLowerCase()), GENERATED_PATH);
    });

    test('mapToGenerated is case insensitive', () => {
        const position: MappedPosition = {line: 0, column: 0, source: GENERATED_PATH};
        assert.deepEqual(sourceMaps.mapToGenerated(AUTHORED_PATH.toUpperCase(), 0, 0), position);
        assert.deepEqual(sourceMaps.mapToGenerated(AUTHORED_PATH.toLowerCase(), 0, 0), position);
    });

    test('mapToAuthored is case insensitive', () => {
        const position: MappedPosition = {line: 0, column: 0, name: null, source: AUTHORED_PATH};
        assert.deepEqual(sourceMaps.mapToAuthored(GENERATED_PATH.toUpperCase(), 0, 0), position);
        assert.deepEqual(sourceMaps.mapToAuthored(GENERATED_PATH.toLowerCase(), 0, 0), position);
    });
});
