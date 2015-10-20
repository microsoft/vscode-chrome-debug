/// <reference path="../../typings/tsd.d.ts" />

/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import assert = require('assert');
import { LineNumberTransformer } from '../../adapter/lineNumberTransformer';

function createTransformer(clientLinesStartAt1: boolean, targetLinesStartAt1: boolean): LineNumberTransformer {
    const transformer = new LineNumberTransformer(targetLinesStartAt1);
    transformer.initialize(<IInitializeRequestArgs><any>{ linesStartAt1: clientLinesStartAt1 });

    return transformer;
}

describe('LineNumberTransformer', () => {
    const c0t0Transformer = createTransformer(false, false);
    const c0t1Transformer = createTransformer(false, true);
    const c1t0Transformer = createTransformer(true, false);
    const c1t1Transformer = createTransformer(true, true);

    describe('setBreakpoints()', () => {
        function getArgs(lines: number[]): DebugProtocol.SetBreakpointsArguments {
            return {
                source: { path: "test/path" },
                lines
            };
        }

        function testSetBreakpoints(transformer: LineNumberTransformer, cLines: number[], tLines: number[] = cLines): void {
            const args = getArgs(cLines);
            transformer.setBreakpoints(args);
            assert.deepEqual(args, getArgs(tLines));
        }

        it('fixes args.lines', () => {
            testSetBreakpoints(c0t0Transformer, [0, 1, 2]);
            testSetBreakpoints(c0t1Transformer, [0, 1, 2], [1, 2, 3]);
            testSetBreakpoints(c1t0Transformer, [1, 2, 3], [0, 1, 2]);
            testSetBreakpoints(c1t1Transformer, [1, 2, 3]);
        });
    });

    describe('setBreakpointsResponse()', () => {
        function getResponse(lines: number[]): SetBreakpointsResponseBody {
            return {
                breakpoints: lines.map(line => ({ verified: true, line: line }))
            };
        }

        function testSetBreakpointsResponse(transformer: LineNumberTransformer, tLines: number[], cLines: number[] = tLines): void {
            const response = getResponse(tLines);
            transformer.setBreakpointsResponse(response);
            assert.deepEqual(response, getResponse(cLines));
        }

        it('fixes the breakpoints\' lines', () => {
            testSetBreakpointsResponse(c0t0Transformer, [0, 1, 2]);
            testSetBreakpointsResponse(c0t1Transformer, [1, 2, 3], [0, 1, 2]);
            testSetBreakpointsResponse(c1t0Transformer, [0, 1, 2], [1, 2, 3]);
            testSetBreakpointsResponse(c1t1Transformer, [1, 2, 3]);
        });
    });

    describe('stackTraceResponse', () => {
        function getResponse(lines: number[]): StackTraceResponseBody {
            return {
                stackFrames: lines.map(line => ({ id: 0, name: '', line, column: 0 }))
            };
        }

        function testStackTraceResponse(transformer: LineNumberTransformer, tLines: number[], cLines: number[] = tLines): void {
            const response = getResponse(tLines);
            transformer.stackTraceResponse(response);
            assert.deepEqual(response, getResponse(cLines));
        }

        it('fixes the stackFrames\' lines', () => {
            testStackTraceResponse(c0t0Transformer, [0, 1, 2]);
            testStackTraceResponse(c0t1Transformer, [1, 2, 3], [0, 1, 2]);
            testStackTraceResponse(c1t0Transformer, [0, 1, 2], [1, 2, 3]);
            testStackTraceResponse(c1t1Transformer, [1, 2, 3]);
        })
    });
});