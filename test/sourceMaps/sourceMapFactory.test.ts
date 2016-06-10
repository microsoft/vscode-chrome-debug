/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from 'assert';
import * as mockery from 'mockery';
import {Mock, It, MockBehavior} from 'typemoq';
import * as path from 'path';

import * as testUtils from '../testUtils';
import * as utils from '../../src/utils';

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

    /**
     * Register a SourceMap mock that asserts that it was called with the correct args. The exception
     * should be caught by the factory, but then it should return null.
     * Should take the same args as the SourceMap constructor, but you can't enforce that with TS.
     * Mocks need to be registered before calling this.
     */
    function setExpectedConstructorArgs(generatedPath: string, json: string, webRoot: string): void {
        const expectedArgs = arguments;
        function mockSourceMapConstructor(): void {
            assert.deepEqual(arguments, expectedArgs);
        }

        mockery.registerMock('./sourceMap', { SourceMap: mockSourceMapConstructor });
        getMapForGeneratedPath = require(MODULE_UNDER_TEST).getMapForGeneratedPath;
    }

    function registerMockGetURL(url: string, contents: string): void {
        const utilsMock = Mock.ofInstance(utils, MockBehavior.Strict);
        mockery.registerMock('../utils', utilsMock.object);
        utilsMock
            .setup(x => x.getURL(It.isValue(url)))
            .returns(() => Promise.resolve(contents));
        utilsMock
            .setup(x => x.isURL(It.isValue(url)))
            .returns(() => true);
    }

    // How these tests basically work - The factory function should call the mocked SourceMap constructor
    // which asserts that it's called with the correct args. Also assert that it returned some object (ie nothing threw or failed);
    suite('getMapForGeneratedPath', () => {
        const GENERATED_SCRIPT_DIRNAME = path.resolve('/project/app/out/');
        const GENERATED_SCRIPT_PATH = path.join(GENERATED_SCRIPT_DIRNAME, 'script.js');
        const GENERATED_SCRIPT_URL = 'http://localhost:8080/app/script.js';

        const WEBROOT = path.resolve('/project/app');
        const FILEDATA = 'data';

        test('resolves inlined sourcemap', () => {
            const sourceMapData = JSON.stringify({ sources: [ 'a.ts', 'b.ts' ]});
            const encodedData = 'data:application/json;base64,' + new Buffer(sourceMapData).toString('base64');
            setExpectedConstructorArgs(GENERATED_SCRIPT_PATH, sourceMapData, WEBROOT);

            return getMapForGeneratedPath(GENERATED_SCRIPT_PATH, encodedData, WEBROOT).then(sourceMap => {
                assert(sourceMap);
            });
        });

        test('returns null on malformed inline sourcemap', () => {
            const encodedData = 'data:application/json;base64,this is not base64-encoded data';
            return getMapForGeneratedPath(GENERATED_SCRIPT_PATH, encodedData, WEBROOT).then(sourceMap => {
                assert(!sourceMap);
            });
        });

        test('handles an absolute path to the sourcemap', () => {
            const absMapPath = path.resolve('/files/app.js.map');
            testUtils.registerMockReadFile({ absPath: absMapPath, data: FILEDATA});
            setExpectedConstructorArgs(GENERATED_SCRIPT_PATH, FILEDATA, WEBROOT);

            return getMapForGeneratedPath(GENERATED_SCRIPT_PATH, absMapPath, WEBROOT).then(sourceMap => {
                assert(sourceMap);
            });
        });

        test('handles a relative path next to the script', () => {
            testUtils.registerMockReadFile({ absPath: GENERATED_SCRIPT_PATH + '.map', data: FILEDATA });
            setExpectedConstructorArgs(GENERATED_SCRIPT_PATH, FILEDATA, WEBROOT);

            return getMapForGeneratedPath(GENERATED_SCRIPT_PATH, 'script.js.map', WEBROOT).then(sourceMap => {
                assert(sourceMap);
            });
        });

        test('handles a relative path with a generated script url', () => {
            registerMockGetURL(GENERATED_SCRIPT_URL + '.map', FILEDATA);
            setExpectedConstructorArgs(GENERATED_SCRIPT_URL, FILEDATA, WEBROOT);

            return getMapForGeneratedPath(GENERATED_SCRIPT_URL, 'script.js.map', WEBROOT).then(sourceMap => {
                assert(sourceMap);
            });
        });

        test('looks for a map file next to the script', () => {
            const badMapPath = path.resolve('/files/app.js.map');
            testUtils.registerMockReadFile(
                { absPath: badMapPath, data: null},
                { absPath: GENERATED_SCRIPT_PATH + '.map', data: FILEDATA });
            setExpectedConstructorArgs(GENERATED_SCRIPT_PATH, FILEDATA, WEBROOT);

            return getMapForGeneratedPath(GENERATED_SCRIPT_PATH, badMapPath, WEBROOT).then(sourceMap => {
                assert(sourceMap);
            });
        });
    });
});