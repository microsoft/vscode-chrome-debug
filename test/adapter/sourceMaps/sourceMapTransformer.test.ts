/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from 'assert';
import * as mockery from 'mockery';

import * as testUtils from '../../testUtils';
import { ISourceMaps, MappingResult } from '../../../adapter/sourceMaps/sourceMaps';

const MODULE_UNDER_TEST = '../../../adapter/sourceMaps/sourceMapTransformer';
const AUTHORED_PATH = 'c:/project/authored.ts';
const RUNTIME_PATH = 'c:/project/runtime.js';
const AUTHORED_LINES = [1, 2, 3];
const RUNTIME_LINES = [2, 5, 8];
const RUNTIME_COLS = [3, 7, 11];

// Not mocked, use for type only
import {SourceMapTransformer as _SourceMapTransformer} from '../../../adapter/sourceMaps/sourceMapTransformer';

suite('SourceMapTransformer', () => {
    let utilsMock: Sinon.SinonMock;

    setup(() => {
        testUtils.setupUnhandledRejectionListener();

        // Set up mockery
        mockery.enable({ warnOnReplace: false, useCleanCache: true });

        utilsMock = testUtils.createRegisteredSinonMock('../../webkit/utilities', testUtils.getDefaultUtilitiesMock());
        mockery.registerAllowables([MODULE_UNDER_TEST, 'path']);
    });

    teardown(() => {
        testUtils.removeUnhandledRejectionListener();
        mockery.deregisterAll();
        mockery.disable();
    });

    function getTransformer(sourceMaps = true, suppressDefaultMock = false): _SourceMapTransformer {
        if (!suppressDefaultMock) {
            mockery.registerMock('./sourceMaps', { SourceMaps: MockSourceMaps });
        }

        utilsMock.expects('getWebRoot').returns(undefined);

        let SourceMapTransformer = require(MODULE_UNDER_TEST).SourceMapTransformer;
        const transformer = new SourceMapTransformer();
        transformer.launch(<ILaunchRequestArgs><any>{
            sourceMaps,
            generatedCodeDirectory: 'test'
        });

        return transformer;
    }

    suite('setBreakpoints()', () => {
        function createArgs(path: string, lines: number[], cols?: number[]): ISetBreakpointsArgs {
            return {
                source: { path },
                lines,
                cols
            };
        }

        test('modifies the source and lines', () => {
            const args = createArgs(AUTHORED_PATH, AUTHORED_LINES);
            const expected = createArgs(RUNTIME_PATH, RUNTIME_LINES, RUNTIME_COLS);

            return getTransformer().setBreakpoints(args, 0).then(() => {
                assert.deepEqual(args, expected);
            });
        });

        test(`doesn't do anything when sourcemaps are disabled`, () => {
            const args = createArgs(RUNTIME_PATH, RUNTIME_LINES);
            const expected = createArgs(RUNTIME_PATH, RUNTIME_LINES);

            return getTransformer(false).setBreakpoints(args, 0).then(() => {
                assert.deepEqual(args, expected);
            });
        });

        test(`if the source can't be mapped, waits until the runtime script is loaded`, () => {
            const args = createArgs(AUTHORED_PATH, AUTHORED_LINES);
            const expected = createArgs(RUNTIME_PATH, RUNTIME_LINES, RUNTIME_COLS);

            const mock = testUtils.createRegisteredSinonMock('./sourceMaps', undefined, 'SourceMaps');
            mock.expects('MapPathFromSource')
                .withExactArgs(AUTHORED_PATH).returns(null);
            mock.expects('MapPathFromSource')
                .withExactArgs(AUTHORED_PATH).returns(RUNTIME_PATH);
            mock.expects('AllMappedSources')
                .withExactArgs(RUNTIME_PATH).returns([AUTHORED_PATH]);
            mock.expects('ProcessNewSourceMap')
                .withExactArgs(RUNTIME_PATH, 'script.js.map').returns(Promise.resolve());
            args.lines.forEach((line, i) => {
                mock.expects('MapFromSource')
                    .withExactArgs(AUTHORED_PATH, line, 0)
                    .returns({ path: RUNTIME_PATH, line: RUNTIME_LINES[i], column: RUNTIME_COLS[i] });
            });

            const transformer = getTransformer(true, true);
            const setBreakpointsP = transformer.setBreakpoints(args, 0).then(() => {
                assert.deepEqual(args, expected);
                mock.verify();
            });

            transformer.scriptParsed(new testUtils.MockEvent('scriptParsed', { scriptUrl: RUNTIME_PATH, sourceMapURL: 'script.js.map' }));
            return setBreakpointsP;
        });

        suite('setBreakpointsResponse()', () => {
            function getResponseBody(lines: number[], column?: number): ISetBreakpointsResponseBody {
                return {
                    breakpoints: lines.map(line => {
                        const bp = { line, verified: true };
                        if (column !== undefined) {
                            (<any>bp).column = column;
                        }

                        return bp;
                    })
                };
            }

            test('modifies the response source and lines', () => {
                const response = getResponseBody(RUNTIME_LINES, /*column=*/0);
                const expected = getResponseBody(AUTHORED_LINES);

                const transformer = getTransformer();
                transformer.setBreakpoints(<DebugProtocol.SetBreakpointsArguments>{
                    source: { path: AUTHORED_PATH },
                    lines: AUTHORED_LINES
                }, 0);
                transformer.setBreakpointsResponse(response, 0);
                assert.deepEqual(response, expected);
            });

            test(`doesn't do anything when sourcemaps are disabled except remove the column`, () => {
                const response = getResponseBody(RUNTIME_LINES, /*column=*/0);
                const expected = getResponseBody(RUNTIME_LINES);

                const transformer = getTransformer(false);
                transformer.setBreakpoints(<DebugProtocol.SetBreakpointsArguments>{
                    source: { path: RUNTIME_PATH },
                    lines: RUNTIME_LINES
                }, 0);
                transformer.setBreakpointsResponse(response, 0);
                assert.deepEqual(response, expected);
            });
        });
    });

    suite('stackTraceResponse()', () => {
        test('modifies the response stackFrames', () => {
            utilsMock.expects('existsSync')
                .thrice()
                .withExactArgs(AUTHORED_PATH).returns(true);

            const response = testUtils.getStackTraceResponseBody(RUNTIME_PATH, RUNTIME_LINES, [1, 2, 3]);
            const expected = testUtils.getStackTraceResponseBody(AUTHORED_PATH, AUTHORED_LINES);

            getTransformer().stackTraceResponse(response);
            assert.deepEqual(response, expected);
        });

        test('clears the path when there are no sourcemaps', () => {
            const response = testUtils.getStackTraceResponseBody(RUNTIME_PATH, RUNTIME_LINES, [1, 2, 3]);
            const expected = testUtils.getStackTraceResponseBody(RUNTIME_PATH, RUNTIME_LINES, [1, 2, 3]);
            expected.stackFrames.forEach(stackFrame => stackFrame.source.path = undefined); // leave name intact

            getTransformer(false).stackTraceResponse(response);
            assert.deepEqual(response, expected);
        });

        test(`keeps the path when the file can't be sourcemapped if it's on disk`, () => {
            const mock = testUtils.createRegisteredSinonMock('./sourceMaps', undefined, 'SourceMaps');

            RUNTIME_LINES.forEach(line => {
                mock.expects('MapToSource')
                    .withExactArgs(RUNTIME_PATH, line, 0).returns(null);
            });
            utilsMock.expects('existsSync')
                .thrice()
                .withExactArgs(RUNTIME_PATH).returns(true);

            const response = testUtils.getStackTraceResponseBody(RUNTIME_PATH, RUNTIME_LINES, [1, 2, 3]);
            const expected = testUtils.getStackTraceResponseBody(RUNTIME_PATH, RUNTIME_LINES);

            getTransformer(true, true).stackTraceResponse(response);
            assert.deepEqual(response, expected);
        });

        test(`clears the path when it can't be sourcemapped and doesn't exist on disk`, () => {
            const mock = testUtils.createRegisteredSinonMock('./sourceMaps', undefined, 'SourceMaps');

            RUNTIME_LINES.forEach(line => {
                mock.expects('MapToSource')
                    .withExactArgs(RUNTIME_PATH, line, 0).returns(null);
            });
            utilsMock.expects('existsSync')
                .thrice()
                .withExactArgs(RUNTIME_PATH).returns(false);

            const response = testUtils.getStackTraceResponseBody(RUNTIME_PATH, RUNTIME_LINES, [1, 2, 3]);
            const expected = testUtils.getStackTraceResponseBody(RUNTIME_PATH, RUNTIME_LINES, [1, 2, 3]);
            expected.stackFrames.forEach(stackFrame => stackFrame.source.path = undefined); // leave name intact

            getTransformer(true, true).stackTraceResponse(response);
            assert.deepEqual(response, expected);
        });
    });
});

class MockSourceMaps implements ISourceMaps {
    constructor(private generatedCodeDirectory: string) { }

    public MapPathFromSource(path: string): string {
        assert.equal(path, AUTHORED_PATH);
        return RUNTIME_PATH;
    }

	/*
	 * Map location in source language to location in generated code.
	 * line and column are 0 based.
	 */
    public MapFromSource(path: string, line: number, column: number): MappingResult {
        assert.equal(path, AUTHORED_PATH);
        assert.equal(column, 0);

        const index = AUTHORED_LINES.indexOf(line);
        const mappedLine = RUNTIME_LINES[index];
        const mappedCol = RUNTIME_COLS[index];
        return { path: RUNTIME_PATH, line: mappedLine, column: mappedCol };
    }

	/*
	 * Map location in generated code to location in source language.
	 * line and column are 0 based.
	 */
    public MapToSource(path: string, line: number, column: number): MappingResult {
        assert.equal(path, RUNTIME_PATH);
        assert.equal(column, 0);

        const mappedLine = AUTHORED_LINES[RUNTIME_LINES.indexOf(line)];
        return { path: AUTHORED_PATH, line: mappedLine, column: 0 };
    }

    public AllMappedSources(pathToGenerated: string): string[] {
        return [AUTHORED_PATH];
    }

    public ProcessNewSourceMap(pathToGenerated: string, sourceMapURL: string): Promise<void> {
        return Promise.resolve<void>();
    }
}
