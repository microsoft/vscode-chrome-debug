/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from 'assert';

import { LineNumberTransformer } from '../../adapter/lineNumberTransformer';
import * as testUtils from '../testUtils';

function createTransformer(clientLinesStartAt1: boolean, targetLinesStartAt1: boolean): LineNumberTransformer {
    const transformer = new LineNumberTransformer(targetLinesStartAt1);
    transformer.initialize(<DebugProtocol.InitializeRequestArguments><any>{ linesStartAt1: clientLinesStartAt1 });

    return transformer;
}

suite('LineNumberTransformer', () => {
    setup(() => {
        testUtils.setupUnhandledRejectionListener();
    });

    teardown(() => {
        testUtils.removeUnhandledRejectionListener();
    });

    const c0t0Transformer = createTransformer(false, false);
    const c0t1Transformer = createTransformer(false, true);
    const c1t0Transformer = createTransformer(true, false);
    const c1t1Transformer = createTransformer(true, true);

    suite('setBreakpoints()', () => {
        function getArgs(lines: number[]): DebugProtocol.SetBreakpointsArguments {
            return {
                source: { path: 'test/path' },
                lines
            };
        }

        function testSetBreakpoints(transformer: LineNumberTransformer, cLines: number[], tLines: number[] = cLines): void {
            const args = getArgs(cLines);
            transformer.setBreakpoints(args);
            assert.deepEqual(args, getArgs(tLines));
        }

        test('fixes args.lines', () => {
            testSetBreakpoints(c0t0Transformer, [0, 1, 2]);
            testSetBreakpoints(c0t1Transformer, [0, 1, 2], [1, 2, 3]);
            testSetBreakpoints(c1t0Transformer, [1, 2, 3], [0, 1, 2]);
            testSetBreakpoints(c1t1Transformer, [1, 2, 3]);
        });
    });

    suite('setBreakpointsResponse()', () => {
        function getResponse(lines: number[]): ISetBreakpointsResponseBody {
            return {
                breakpoints: lines.map(line => ({ verified: true, line: line }))
            };
        }

        function testSetBreakpointsResponse(transformer: LineNumberTransformer, tLines: number[], cLines: number[] = tLines): void {
            const response = getResponse(tLines);
            transformer.setBreakpointsResponse(response);
            assert.deepEqual(response, getResponse(cLines));
        }

        test('fixes the breakpoints\' lines', () => {
            testSetBreakpointsResponse(c0t0Transformer, [0, 1, 2]);
            testSetBreakpointsResponse(c0t1Transformer, [1, 2, 3], [0, 1, 2]);
            testSetBreakpointsResponse(c1t0Transformer, [0, 1, 2], [1, 2, 3]);
            testSetBreakpointsResponse(c1t1Transformer, [1, 2, 3]);
        });
    });

    suite('stackTraceResponse()', () => {
        function getResponse(lines: number[]): IStackTraceResponseBody {
            return {
                stackFrames: lines.map(line => ({ id: 0, name: '', line, column: 0 }))
            };
        }

        function testStackTraceResponse(transformer: LineNumberTransformer, tLines: number[], cLines: number[] = tLines): void {
            const response = getResponse(tLines);
            transformer.stackTraceResponse(response);
            assert.deepEqual(response, getResponse(cLines));
        }

        test('fixes the stackFrames\' lines', () => {
            testStackTraceResponse(c0t0Transformer, [0, 1, 2]);
            testStackTraceResponse(c0t1Transformer, [1, 2, 3], [0, 1, 2]);
            testStackTraceResponse(c1t0Transformer, [0, 1, 2], [1, 2, 3]);
            testStackTraceResponse(c1t1Transformer, [1, 2, 3]);
        });
    });
});