/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from 'assert';
import * as mockery from 'mockery';

import * as testUtils from '../testUtils';

import {getMapForGeneratedPath as _getMapForGeneratedPath} from '../../src/sourceMaps/sourceMapFactory';
const MODULE_UNDER_TEST = '../../src/sourceMaps/sourceMapFactory';

/**
 * Unit tests for SourceMap + source-map (the mozilla lib). source-map is included in the test and not mocked
 */
suite('SourceMapFactory', () => {
    let getMapForGeneratedPath: typeof _getMapForGeneratedPath;

    setup(() => {
        testUtils.setupUnhandledRejectionListener();

        // Set up mockery
        mockery.enable({ warnOnReplace: false, useCleanCache: true, warnOnUnregistered: false });
    });

    teardown(() => {
        testUtils.removeUnhandledRejectionListener();
        mockery.deregisterAll();
        mockery.disable();
    });

    // Should take the same args as the SourceMap constructor, but you can't enforce that with TS
    function setExpectedConstructorArgs(generatedPath: string, json: string, webRoot: string): void {
        const expectedArgs = arguments;
        function mockSourceMapConstructor(): void {
            assert.deepEqual(arguments, expectedArgs);
        }

        mockery.registerMock('./sourceMap', { SourceMap: mockSourceMapConstructor });
        getMapForGeneratedPath = require(MODULE_UNDER_TEST).getMapForGeneratedPath;
    }

    // How these tests basically work - The factory function should call the mocked SourceMap constructor
    // which asserts that it's called with the correct args. Also assert that it returned some object (ie nothing threw or failed);
    suite('getMapForGeneratedPath', () => {
        const GENERATED_PATH = testUtils.pathResolve('/project/app/out/script.js');
        const WEBROOT = testUtils.pathResolve('/project/app');

        test('resolves inlined sourcemap', () => {
            const sourceMapData = JSON.stringify({ sources: [ 'a.ts', 'b.ts' ]});
            const encodedData = 'data:application/json;base64,' + new Buffer(sourceMapData).toString('base64');
            setExpectedConstructorArgs(GENERATED_PATH, sourceMapData, WEBROOT);

            return getMapForGeneratedPath(GENERATED_PATH, encodedData, WEBROOT).then(sourceMap => {
                assert(sourceMap);
            });
        });
    });
});