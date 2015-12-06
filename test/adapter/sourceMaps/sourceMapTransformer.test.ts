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

const AUTHORED_PATH2 = 'c:/project/authored2.ts';
const AUTHORED_LINES2 = [90, 105];
const RUNTIME_LINES2 = [78, 81];
const RUNTIME_COLS2 = [0, 1];

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
            mockery.registerMock('./sourceMaps', { SourceMaps: StubSourceMaps });
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

        function createExpectedArgs(authoredPath: string, path: string, lines: number[], cols?: number[]): ISetBreakpointsArgs {
            const args = createArgs(path, lines, cols);
            args.authoredPath = authoredPath;
            return args;
        }

        function createMergedSourcesMock(args: ISetBreakpointsArgs, args2: ISetBreakpointsArgs): Sinon.SinonMock {
            const mock = testUtils.createRegisteredSinonMock('./sourceMaps', undefined, 'SourceMaps');
            mock.expects('MapPathFromSource')
                .withExactArgs(AUTHORED_PATH).returns(RUNTIME_PATH);
            mock.expects('MapPathFromSource')
                .withExactArgs(AUTHORED_PATH2).returns(RUNTIME_PATH);
            mock.expects('AllMappedSources')
                .twice()
                .withExactArgs(RUNTIME_PATH).returns([AUTHORED_PATH, AUTHORED_PATH2]);
            args.lines.forEach((line, i) => {
                mock.expects('MapFromSource')
                    .withExactArgs(AUTHORED_PATH, line, 0)
                    .returns({ path: RUNTIME_PATH, line: RUNTIME_LINES[i], column: RUNTIME_COLS[i] });
            });
            args2.lines.forEach((line, i) => {
                mock.expects('MapFromSource')
                    .withExactArgs(AUTHORED_PATH2, line, 0)
                    .returns({ path: RUNTIME_PATH, line: RUNTIME_LINES2[i], column: RUNTIME_COLS2[i] });
            });

            return mock;
        }

        test('modifies the source and lines', () => {
            const args = createArgs(AUTHORED_PATH, AUTHORED_LINES);
            const expected = createExpectedArgs(AUTHORED_PATH, RUNTIME_PATH, RUNTIME_LINES, RUNTIME_COLS);

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
            const expected = createExpectedArgs(AUTHORED_PATH, RUNTIME_PATH, RUNTIME_LINES, RUNTIME_COLS);

            const mock = testUtils.createRegisteredSinonMock('./sourceMaps', undefined, 'SourceMaps');
            mock.expects('MapPathFromSource')
                .withExactArgs(AUTHORED_PATH).returns(null);
            mock.expects('MapPathFromSource')
                .withExactArgs(AUTHORED_PATH).returns(RUNTIME_PATH);
            mock.expects('AllMappedSources')
                .twice()
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

        test('if the source maps to a merged file, includes the breakpoints in other files that map to the same file', () => {
            const args = createArgs(AUTHORED_PATH, AUTHORED_LINES);
            const args2 = createArgs(AUTHORED_PATH2, AUTHORED_LINES2);
            const expected = createExpectedArgs(AUTHORED_PATH2, RUNTIME_PATH, RUNTIME_LINES2.concat(RUNTIME_LINES), RUNTIME_COLS2.concat(RUNTIME_COLS));
            const mock = createMergedSourcesMock(args, args2);

            const transformer = getTransformer(true, true);
            return transformer.setBreakpoints(args, 0).then(() => {
                return transformer.setBreakpoints(args2, 1);
            }).then(() => {
                assert.deepEqual(args2, expected);
                mock.verify();
            });
        });

        suite('setBreakpointsResponse()', () => {
            function getResponseBody(lines: number[], column?: number): ISetBreakpointsResponseBody {
                return {
                    breakpoints: lines.map(line => {
                        const bp: IBreakpoint = { line, verified: true };
                        if (column !== undefined) {
                            bp.column = column;
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

            test(`if the source maps to a merged file, filters breakpoint results from other files`, () => {
                const setBPArgs = createArgs(AUTHORED_PATH, AUTHORED_LINES);
                const setBPArgs2 = createArgs(AUTHORED_PATH2, AUTHORED_LINES2);
                const response = getResponseBody(RUNTIME_LINES2.concat(RUNTIME_LINES), /*column=*/0);
                const expected = getResponseBody(AUTHORED_LINES2);

                const mock = createMergedSourcesMock(setBPArgs, setBPArgs2);
                RUNTIME_LINES2.forEach((line, i) => {
                    mock.expects('MapToSource')
                        .withExactArgs(RUNTIME_PATH, line, 0)
                        .returns({ path: AUTHORED_PATH2, line: AUTHORED_LINES2[i] });
                });

                const transformer = getTransformer(true, true);
                return transformer.setBreakpoints(setBPArgs, 0).then(() => {
                    return transformer.setBreakpoints(setBPArgs2, 1);
                }).then(() => {
                    transformer.setBreakpointsResponse(response, 1);
                    assert.deepEqual(response, expected);
                    mock.verify();
                });
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

class StubSourceMaps implements ISourceMaps {
    constructor(private generatedCodeDirectory: string) { }

    public MapPathFromSource(path: string): string {
        return RUNTIME_PATH;
    }

	/*
	 * Map location in source language to location in generated code.
	 * line and column are 0 based.
	 */
    public MapFromSource(path: string, line: number, column: number): MappingResult {
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
