/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from 'assert';
import * as mockery from 'mockery';
import * as testUtils from '../../testUtils';
import { ISourceMaps, MappingResult } from '../../../adapter/sourceMaps/sourceMaps';

const MODULE_UNDER_TEST = '../../../adapter/sourceMaps/sourceMapTransformer';
const AUTHORED_PATH = 'authored.ts';
const RUNTIME_PATH = 'runtime.js';
const AUTHORED_LINES = [1, 2, 3];
const RUNTIME_LINES = [2, 5, 8];
const RUNTIME_COLS = [3, 7, 11];

// Not mocked, use for type only
import {SourceMapTransformer as _SourceMapTransformer} from '../../../adapter/sourceMaps/sourceMapTransformer';

suite('SourceMapTransformer', () => {
    setup(() => {
        testUtils.setupUnhandledRejectionListener();

        // Set up mockery with SourceMaps mock
        mockery.enable({ warnOnReplace: false, useCleanCache: true });
        mockery.registerAllowables(['os', 'fs', 'url', 'path', '../../webkit/utilities', MODULE_UNDER_TEST]);
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

            const mock = testUtils.getRegisteredSinonMock('./sourceMaps', undefined, 'SourceMaps');
            mock.expects('MapPathFromSource')
                .once()
                .withArgs(AUTHORED_PATH).returns(null);
            mock.expects('MapPathFromSource')
                .once()
                .withArgs(AUTHORED_PATH).returns(RUNTIME_PATH);
            args.lines.forEach((line, i) => {
                mock.expects('MapFromSource')
                    .once()
                    .withArgs(AUTHORED_PATH, line, 0)
                    .returns({ path: RUNTIME_PATH, line: RUNTIME_LINES[i], column: RUNTIME_COLS[i] });
            });
            mock.expects('MapToSource')
                .withArgs(RUNTIME_PATH, 0, 0).returns({ path: AUTHORED_PATH });

            const transformer = getTransformer(true, true);
            const setBreakpointsP = transformer.setBreakpoints(args, 0).then(() => {
                assert.deepEqual(args, expected);
                mock.verify();
            });

            transformer.scriptParsed(new testUtils.MockEvent('scriptParsed', { scriptUrl: RUNTIME_PATH }));
            return setBreakpointsP;
        });

        suite('setBreakpointsResponse()', () => {
            function getResponseBody(lines: number[], column?: number): SetBreakpointsResponseBody {
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

    suite('stackTraceResponse', () => {
        function getResponseBody(path: string, lines: number[]): StackTraceResponseBody {
            return {
                stackFrames: lines.map((line, i) => ({
                    id: i,
                    name: 'line ' + i,
                    line,
                    column: 0,
                    source: { path }
                }))
            };
        }

        test('modifies the response stackFrames', () => {
            const response = getResponseBody(RUNTIME_PATH, RUNTIME_LINES);
            const expected = getResponseBody(AUTHORED_PATH, AUTHORED_LINES);

            getTransformer().stackTraceResponse(response);
            assert.deepEqual(response, expected);
        });

        test('does nothing when there are no sourcemaps', () => {
            const response = getResponseBody(RUNTIME_PATH, RUNTIME_LINES);
            const expected = getResponseBody(RUNTIME_PATH, RUNTIME_LINES);

            getTransformer(false).stackTraceResponse(response);
            assert.deepEqual(response, expected);
        });
    });

    suite('scriptParsed()', () => {
        test('calls MapToSource', () => {
            getTransformer().scriptParsed(new testUtils.MockEvent('scriptParsed', { scriptUrl: RUNTIME_PATH }));
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
}
