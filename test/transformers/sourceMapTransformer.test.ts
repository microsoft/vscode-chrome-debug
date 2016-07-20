/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {DebugProtocol} from 'vscode-debugprotocol';

import * as assert from 'assert';
import * as mockery from 'mockery';
import {Mock, MockBehavior, It} from 'typemoq';

import {ISetBreakpointsResponseBody,
    ILaunchRequestArgs, ISetBreakpointsArgs} from '../../src/debugAdapterInterfaces';
import * as testUtils from '../testUtils';
import {SourceMaps} from '../../src/sourceMaps/sourceMaps';
import {MappedPosition} from '../../src/sourceMaps/sourceMap';
import * as utils from '../../src/utils';

const MODULE_UNDER_TEST = '../../src/transformers/sourceMapTransformer';

const AUTHORED_PATH = testUtils.pathResolve('/project/authored.ts');
const RUNTIME_PATH = testUtils.pathResolve('/project/runtime.js');
const AUTHORED_LINES = [1, 2, 3];
const RUNTIME_LINES = [2, 5, 8];
const RUNTIME_COLS = [3, 7, 11];

const AUTHORED_PATH2 = testUtils.pathResolve('/project/authored2.ts');
const AUTHORED_LINES2 = [90, 105];
const RUNTIME_LINES2 = [78, 81];
const RUNTIME_COLS2 = [0, 1];

// Not mocked, use for type only
import {SourceMapTransformer as _SourceMapTransformer} from '../../src/transformers/sourceMapTransformer';

suite('SourceMapTransformer', () => {
    let utilsMock: Mock<typeof utils>;

    setup(() => {
        testUtils.setupUnhandledRejectionListener();

        // Mock the utils module
        utilsMock = Mock.ofInstance(utils);
        utilsMock.callBase = true;
        mockery.registerMock('../utils', utilsMock.object);

        // Set up mockery
        mockery.enable({ warnOnReplace: false, useCleanCache: true, warnOnUnregistered: false });
    });

    teardown(() => {
        testUtils.removeUnhandledRejectionListener();
        mockery.deregisterAll();
        mockery.disable();
    });

    function getTransformer(sourceMaps = true, suppressDefaultMock = false): _SourceMapTransformer {
        if (!suppressDefaultMock) {
            mockery.registerMock('../sourceMaps/sourceMaps', { SourceMaps: StubSourceMaps });
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

        function createExpectedArgs(authoredPath: string, path: string, lines: number[], cols?: number[]): ISetBreakpointsArgs {
            const args = createArgs(path, lines, cols);
            args.authoredPath = authoredPath;
            return args;
        }

        function createMergedSourcesMock(args: ISetBreakpointsArgs, args2: ISetBreakpointsArgs): Mock<SourceMaps> {
            const mock = Mock.ofType(SourceMaps, MockBehavior.Strict);
            mockery.registerMock('../sourceMaps/sourceMaps', { SourceMaps: () => mock.object });
            mock
                .setup(x => x.getGeneratedPathFromAuthoredPath(It.isValue(AUTHORED_PATH)))
                .returns(() => RUNTIME_PATH).verifiable();
            mock
                .setup(x => x.getGeneratedPathFromAuthoredPath(It.isValue(AUTHORED_PATH2)))
                .returns(() => RUNTIME_PATH).verifiable();
            mock
                .setup(x => x.allMappedSources(It.isValue(RUNTIME_PATH)))
                .returns(() => [AUTHORED_PATH, AUTHORED_PATH2]).verifiable();
            args.lines.forEach((line, i) => {
                mock
                    .setup(x => x.mapToGenerated(It.isValue(AUTHORED_PATH), It.isValue(line), It.isValue(0)))
                    .returns(() => ({ source: RUNTIME_PATH, line: RUNTIME_LINES[i], column: RUNTIME_COLS[i] })).verifiable();
            });
            args2.lines.forEach((line, i) => {
                mock
                    .setup(x => x.mapToGenerated(It.isValue(AUTHORED_PATH2), It.isValue(line), It.isValue(0)))
                    .returns(() => ({ source: RUNTIME_PATH, line: RUNTIME_LINES2[i], column: RUNTIME_COLS2[i] })).verifiable();
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

            return getTransformer(/*sourceMaps=*/false).setBreakpoints(args, 0).then(() => {
                assert.deepEqual(args, expected);
            });
        });

        test(`if the source can't be mapped, waits until the runtime script is loaded`, () => {
            const args = createArgs(AUTHORED_PATH, AUTHORED_LINES);
            const expected = createExpectedArgs(AUTHORED_PATH, RUNTIME_PATH, RUNTIME_LINES, RUNTIME_COLS);
            const sourceMapURL = 'script.js.map';

            const mock = Mock.ofType(SourceMaps, MockBehavior.Strict);
            mockery.registerMock('../sourceMaps/sourceMaps', { SourceMaps: () => mock.object });
            mock
                .setup(x => x.getGeneratedPathFromAuthoredPath(It.isValue(AUTHORED_PATH)))
                .returns(() => null).verifiable();
            mock
                .setup(x => x.getGeneratedPathFromAuthoredPath(It.isValue(AUTHORED_PATH)))
                .returns(() => RUNTIME_PATH).verifiable();
            mock
                .setup(x => x.allMappedSources(It.isValue(RUNTIME_PATH)))
                .returns(() => [AUTHORED_PATH]).verifiable();
            mock
                .setup(x => x.processNewSourceMap(It.isValue(RUNTIME_PATH), It.isValue(sourceMapURL)))
                .returns(() => Promise.resolve<void>()).verifiable();
            args.lines.forEach((line, i) => {
                mock
                    .setup(x => x.mapToGenerated(It.isValue(AUTHORED_PATH), It.isValue(line), It.isValue(0)))
                    .returns(() => ({ source: RUNTIME_PATH, line: RUNTIME_LINES[i], column: RUNTIME_COLS[i] })).verifiable();
            });

            const transformer = getTransformer(/*sourceMaps=*/true, /*suppressDefaultMock=*/true);
            const setBreakpointsP = transformer.setBreakpoints(args, /*requestSeq=*/0).then(() => {
                assert.deepEqual(args, expected);
                mock.verifyAll();
            });

            transformer.scriptParsed(new testUtils.MockEvent('scriptParsed', { scriptUrl: RUNTIME_PATH, sourceMapURL }));
            return setBreakpointsP;
        });

        test('if the source maps to a merged file, includes the breakpoints in other files that map to the same file', () => {
            const args = createArgs(AUTHORED_PATH, AUTHORED_LINES);
            const args2 = createArgs(AUTHORED_PATH2, AUTHORED_LINES2);
            const expected = createExpectedArgs(AUTHORED_PATH2, RUNTIME_PATH, RUNTIME_LINES2.concat(RUNTIME_LINES), RUNTIME_COLS2.concat(RUNTIME_COLS));
            const mock = createMergedSourcesMock(args, args2);

            const transformer = getTransformer(/*sourceMaps=*/true, /*suppressDefaultMock=*/true);
            return transformer.setBreakpoints(args, 0).then(() => {
                return transformer.setBreakpoints(args2, 1);
            }).then(() => {
                assert.deepEqual(args2, expected);
                mock.verifyAll();
            });
        });

        suite('setBreakpointsResponse()', () => {
            function getResponseBody(lines: number[], column?: number): ISetBreakpointsResponseBody {
                return {
                    breakpoints: lines.map(line => {
                        const bp: DebugProtocol.Breakpoint = { line, verified: true };
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

                const transformer = getTransformer(/*sourceMaps=*/false);
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
                    mock
                        .setup(x => x.mapToAuthored(It.isValue(RUNTIME_PATH), It.isValue(line), It.isValue(0)))
                        .returns(() => ({ source: AUTHORED_PATH2, line: AUTHORED_LINES2[i], column: 0 })).verifiable();
                });

                const transformer = getTransformer(/*sourceMaps=*/true, /*suppressDefaultMock=*/true);
                return transformer.setBreakpoints(setBPArgs, /*requestSeq=*/0)
                    .then(() => transformer.setBreakpoints(setBPArgs2, /*requestSeq=*/1))
                    .then(() => {
                        transformer.setBreakpointsResponse(response, /*requestSeq=*/1);
                        assert.deepEqual(response, expected);
                        mock.verifyAll();
                    });
            });
        });
    });

    suite('stackTraceResponse()', () => {
        test('modifies the response stackFrames', () => {
            utilsMock
                .setup(x => x.existsSync(It.isValue(AUTHORED_PATH)))
                .returns(() => true);

            const response = testUtils.getStackTraceResponseBody(RUNTIME_PATH, RUNTIME_LINES, [1, 2, 3]);
            const expected = testUtils.getStackTraceResponseBody(AUTHORED_PATH, AUTHORED_LINES);

            getTransformer().stackTraceResponse(response);
            assert.deepEqual(response, expected);
        });

        test('clears the path when there are no sourcemaps', () => {
            const response = testUtils.getStackTraceResponseBody(RUNTIME_PATH, RUNTIME_LINES, [1, 2, 3]);
            const expected = testUtils.getStackTraceResponseBody(RUNTIME_PATH, RUNTIME_LINES, [1, 2, 3]);
            expected.stackFrames.forEach(stackFrame => stackFrame.source.path = undefined); // leave name intact

            getTransformer(/*sourceMaps=*/false).stackTraceResponse(response);
            assert.deepEqual(response, expected);
        });

        test(`keeps the path when the file can't be sourcemapped if it's on disk`, () => {
            const mock = Mock.ofType(SourceMaps, MockBehavior.Strict);
            mockery.registerMock('../sourceMaps/sourceMaps', { SourceMaps: () => mock.object });

            RUNTIME_LINES.forEach(line => {
                mock
                    .setup(x => x.mapToAuthored(It.isValue(RUNTIME_PATH), It.isValue(line), It.isValue(0)))
                    .returns(() => null).verifiable();
            });
            utilsMock
                .setup(x => x.existsSync(It.isValue(RUNTIME_PATH)))
                .returns(() => true);

            const response = testUtils.getStackTraceResponseBody(RUNTIME_PATH, RUNTIME_LINES, [1, 2, 3]);
            const expected = testUtils.getStackTraceResponseBody(RUNTIME_PATH, RUNTIME_LINES);

            getTransformer(/*sourceMaps=*/true, /*suppressDefaultMock=*/true).stackTraceResponse(response);
            assert.deepEqual(response, expected);
            mock.verifyAll();
        });

        test(`clears the path and name when it can't be sourcemapped and doesn't exist on disk`, () => {
            const mock = Mock.ofType(SourceMaps, MockBehavior.Strict);
            mockery.registerMock('../sourceMaps/sourceMaps', { SourceMaps: () => mock.object });

            RUNTIME_LINES.forEach(line => {
                mock
                    .setup(x => x.mapToAuthored(It.isValue(RUNTIME_PATH), It.isValue(line), It.isValue(0)))
                    .returns(() => null).verifiable();
            });
            utilsMock
                .setup(x => x.existsSync(It.isValue(RUNTIME_PATH)))
                .returns(() => false);

            const response = testUtils.getStackTraceResponseBody(RUNTIME_PATH, RUNTIME_LINES, [1, 2, 3]);
            const expected = testUtils.getStackTraceResponseBody(RUNTIME_PATH, RUNTIME_LINES, [1, 2, 3]);
            expected.stackFrames.forEach(stackFrame => {
                stackFrame.source.name = 'eval: ' + stackFrame.source.sourceReference;
                stackFrame.source.path = undefined;
            });

            getTransformer(/*sourceMaps=*/true, /*suppressDefaultMock=*/true).stackTraceResponse(response);
            assert.deepEqual(response, expected);
            mock.verifyAll();
        });
    });
});

class StubSourceMaps {
    constructor(private generatedCodeDirectory: string) { }

    public getGeneratedPathFromAuthoredPath(path: string): string {
        return RUNTIME_PATH;
    }

	/*
	 * Map location in source language to location in generated code.
	 * line and column are 0 based.
	 */
    public mapToGenerated(path: string, line: number, column: number): MappedPosition {
        const index = AUTHORED_LINES.indexOf(line);
        const mappedLine = RUNTIME_LINES[index];
        const mappedCol = RUNTIME_COLS[index];
        return { source: RUNTIME_PATH, line: mappedLine, column: mappedCol };
    }

	/*
	 * Map location in generated code to location in source language.
	 * line and column are 0 based.
	 */
    public mapToAuthored(path: string, line: number, column: number): MappedPosition {
        const mappedLine = AUTHORED_LINES[RUNTIME_LINES.indexOf(line)];
        return { source: AUTHORED_PATH, line: mappedLine, column: 0 };
    }

    public allMappedSources(pathToGenerated: string): string[] {
        return [AUTHORED_PATH];
    }

    public processNewSourceMap(pathToGenerated: string, sourceMapURL: string): Promise<void> {
        return Promise.resolve<void>();
    }
}
