/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {DebugProtocol} from 'vscode-debugprotocol';

import {getMockLineNumberTransformer, getMockPathTransformer, getMockSourceMapTransformer} from '../mocks/transformerMocks';

import {ISetBreakpointsResponseBody} from '../../src/debugAdapterInterfaces';
import * as Chrome from '../../src/chrome/chromeDebugProtocol';
import {ChromeConnection} from '../../src/chrome/chromeConnection';

import {LineNumberTransformer} from '../../src/transformers/lineNumberTransformer';
import {BaseSourceMapTransformer} from '../../src/transformers/baseSourceMapTransformer';
import {UrlPathTransformer} from '../../src/transformers/urlPathTransformer';

import * as mockery from 'mockery';
import {EventEmitter} from 'events';
import * as assert from 'assert';
import {Mock, MockBehavior, It} from 'typemoq';

import * as testUtils from '../testUtils';
import * as utils from '../../src/utils';

/** Not mocked - use for type only */
import {ChromeDebugAdapter as _ChromeDebugAdapter} from '../../src/chrome/chromeDebugAdapter';

const MODULE_UNDER_TEST = '../../src/chrome/chromeDebugAdapter';
suite('ChromeDebugAdapter', () => {
    const ATTACH_ARGS = { port: 9222 };

    let mockChromeConnection: Mock<ChromeConnection>;
    let mockEventEmitter: EventEmitter;
    let mockLineNumberTransformer: Mock<LineNumberTransformer>;
    let mockSourceMapTransformer: Mock<BaseSourceMapTransformer>;
    let mockPathTransformer: Mock<UrlPathTransformer>;

    let chromeDebugAdapter: _ChromeDebugAdapter;

    setup(() => {
        testUtils.setupUnhandledRejectionListener();
        mockery.enable({ useCleanCache: true, warnOnReplace: false, warnOnUnregistered: false });
        testUtils.registerWin32Mocks();

        // Create a ChromeConnection mock with .on and .attach. Tests can fire events via mockEventEmitter
        mockEventEmitter = new EventEmitter();
        mockChromeConnection = Mock.ofType(ChromeConnection, MockBehavior.Strict);
        mockChromeConnection
            .setup(x => x.on(It.isAnyString(), It.isAny()))
            .callback((eventName: string, handler: (msg: any) => void) => mockEventEmitter.on(eventName, handler));
        mockChromeConnection
            .setup(x => x.attach(It.isValue(undefined), It.isAnyNumber(), It.isValue(undefined)))
            .returns(() => Promise.resolve<void>());
        mockChromeConnection
            .setup(x => x.isAttached)
            .returns(() => false);

        mockLineNumberTransformer = getMockLineNumberTransformer();
        mockSourceMapTransformer = getMockSourceMapTransformer();
        mockPathTransformer = getMockPathTransformer();

        // Instantiate the ChromeDebugAdapter, injecting the mock ChromeConnection
        chromeDebugAdapter = new (require(MODULE_UNDER_TEST).ChromeDebugAdapter)({
            chromeConnection: () => mockChromeConnection.object,
            lineNumberTransformer: () => mockLineNumberTransformer.object,
            sourceMapTransformer: () => mockSourceMapTransformer.object,
            pathTransformer: () => mockPathTransformer.object
        });
    });

    teardown(() => {
        testUtils.removeUnhandledRejectionListener();
        mockery.deregisterAll();
        mockery.disable();
        mockChromeConnection.verifyAll();
    });

    suite('attach()', () => {
        test('if successful, an initialized event is fired', () => {
            let initializedFired = false;

            chromeDebugAdapter.registerEventHandler((event: DebugProtocol.Event) => {
                if (event.event === 'initialized') {
                    initializedFired = true;
                } else {
                    testUtils.assertFail('An unexpected event was fired');
                }
            });

            return chromeDebugAdapter.attach(ATTACH_ARGS).then(() => {
                assert(initializedFired, 'Attach completed without firing the initialized event');
            });
        });

        test('if unsuccessful, the promise is rejected and an initialized event is not fired', () => {
            mockChromeConnection
                .setup(x => x.attach(It.isValue(undefined), It.isAnyNumber()))
                .returns(() => utils.errP('Testing attach failed'));

            chromeDebugAdapter.registerEventHandler((event: DebugProtocol.Event) => {
                testUtils.assertFail('Not expecting any event in this scenario');
            });

            return chromeDebugAdapter.attach(ATTACH_ARGS).then(
                () => testUtils.assertFail('Expecting promise to be rejected'),
                e => { /* Expecting promise to be rejected */ });
        });
    });

    suite('setBreakpoints()', () => {
        const BP_ID = 'bpId';
        const FILE_NAME = 'file:///a.js';
        const SCRIPT_ID = '1';
        function expectSetBreakpoint(breakpoints: DebugProtocol.SourceBreakpoint[], url?: string, scriptId = SCRIPT_ID): void {
            breakpoints.forEach((bp, i) => {
                const { line: lineNumber, column: columnNumber, condition } = bp;

                if (url) {
                    mockChromeConnection
                        .setup(x => x.debugger_setBreakpointByUrl(url, lineNumber, columnNumber, condition))
                        .returns(location => Promise.resolve(
                            <Chrome.Debugger.SetBreakpointByUrlResponse>{ id: 0, result: { breakpointId: BP_ID + i, locations: [{ scriptId, lineNumber, columnNumber }] } }))
                        .verifiable();
                } else {
                    mockChromeConnection
                        .setup(x => x.debugger_setBreakpoint(It.isAny(), condition))
                        .returns(location => Promise.resolve(
                            <Chrome.Debugger.SetBreakpointResponse>{ id: 0, result: { breakpointId: BP_ID + i, actualLocation: { scriptId, lineNumber, columnNumber } } }))
                        .verifiable();
                }
            });
        }

        function expectRemoveBreakpoint(indicies: number[]): void {
            indicies.forEach(i => {
                mockChromeConnection
                    .setup(x => x.debugger_removeBreakpoint(It.isValue(BP_ID + i)))
                    .returns(() => Promise.resolve(<Chrome.Response>{ id: 0 }))
                    .verifiable();
            });
        }

        function makeExpectedResponse(breakpoints: DebugProtocol.SourceBreakpoint[]): ISetBreakpointsResponseBody {
            const resultBps = breakpoints.map((bp, i) => ({
                line: bp.line,
                column: bp.column || 0,
                verified: true
            }));

            return { breakpoints: resultBps };
        }

        function assertExpectedResponse(response: ISetBreakpointsResponseBody, breakpoints: DebugProtocol.SourceBreakpoint[]): void {
            // Assert that each bp has some id, then remove, because we don't know or care what it is
            response.breakpoints.forEach(bp => {
                assert(typeof bp.id === 'number');
                delete bp.id;
            });

            assert.deepEqual(response, makeExpectedResponse(breakpoints));
        }

        function emitScriptParsed(url = FILE_NAME, scriptId = SCRIPT_ID): void {
            mockSourceMapTransformer.setup(m => m.scriptParsed(It.isValue(undefined), It.isValue(undefined)))
                .returns(() => Promise.resolve([]));

            mockEventEmitter.emit('Debugger.scriptParsed', <Chrome.Debugger.Script>{ scriptId, url });
        }

        test('When setting one breakpoint, returns the correct result', () => {
            const breakpoints: DebugProtocol.SourceBreakpoint[] = [
                { line: 5, column: 6 }
            ];
            expectSetBreakpoint(breakpoints, FILE_NAME);

            return chromeDebugAdapter.attach(ATTACH_ARGS)
                .then(() => emitScriptParsed())
                .then(() => chromeDebugAdapter.setBreakpoints({ source: { path: FILE_NAME }, breakpoints }, 0))
                .then(response => assertExpectedResponse(response, breakpoints));
        });

        test('When setting multiple breakpoints, returns the correct result', () => {
            const breakpoints = [
                { line: 14, column: 33 },
                { line: 200, column: 16 },
                { line: 151, column: 1 }
            ];
            expectSetBreakpoint(breakpoints, FILE_NAME);

            return chromeDebugAdapter.attach(ATTACH_ARGS)
                .then(() => emitScriptParsed())
                .then(() => chromeDebugAdapter.setBreakpoints({ source: { path: FILE_NAME }, breakpoints}, 0))
                .then(response => assertExpectedResponse(response, breakpoints));
        });

        test('The adapter clears all previous breakpoints in a script before setting the new ones', () => {
            const breakpoints = [
                { line: 14, column: 33 },
                { line: 200, column: 16 }
            ];
            expectSetBreakpoint(breakpoints, FILE_NAME);

            return chromeDebugAdapter.attach(ATTACH_ARGS)
                .then(() => emitScriptParsed())
                .then(() => chromeDebugAdapter.setBreakpoints({ source: { path: FILE_NAME }, breakpoints }, 0))
                .then(response => {
                    breakpoints.push({ line: 321, column: 123 });

                    expectRemoveBreakpoint([0, 1]);
                    expectSetBreakpoint(breakpoints, FILE_NAME);

                    return chromeDebugAdapter.setBreakpoints({ source: { path: FILE_NAME }, breakpoints }, 0);
                })
                .then(response => assertExpectedResponse(response, breakpoints));
        });

        test('The adapter handles removing a breakpoint', () => {
            const breakpoints = [
                { line: 14, column: 33 },
                { line: 200, column: 16 }
            ];
            expectSetBreakpoint(breakpoints, FILE_NAME);

            return chromeDebugAdapter.attach(ATTACH_ARGS)
                .then(() => emitScriptParsed())
                .then(() => chromeDebugAdapter.setBreakpoints({ source: { path: FILE_NAME }, breakpoints}, 0))
                .then(response => {
                    breakpoints.shift();

                    expectRemoveBreakpoint([0, 1]);
                    expectSetBreakpoint(breakpoints, FILE_NAME);
                    return chromeDebugAdapter.setBreakpoints({ source: { path: FILE_NAME }, breakpoints}, 0);
                })
                .then(response => assertExpectedResponse(response, breakpoints));
        });

        test('After a page refresh, clears the newly resolved breakpoints before adding new ones', () => {
            const breakpoints = [
                { line: 14, column: 33 },
                { line: 200, column: 16 }
            ];
            expectSetBreakpoint(breakpoints, FILE_NAME);

            return chromeDebugAdapter.attach(ATTACH_ARGS)
                .then(() => emitScriptParsed())
                .then(() => chromeDebugAdapter.setBreakpoints({ source: { path: FILE_NAME }, breakpoints }, 0))
                .then(response => {
                    expectRemoveBreakpoint([2, 3]);
                    mockEventEmitter.emit('Debugger.globalObjectCleared');
                    mockEventEmitter.emit('Debugger.scriptParsed', <Chrome.Debugger.Script>{ scriptId: 'afterRefreshScriptId', url: FILE_NAME });
                    mockEventEmitter.emit('Debugger.breakpointResolved', <Chrome.Debugger.BreakpointResolvedParams>{ breakpointId: BP_ID + 2, location: { scriptId: 'afterRefreshScriptId' } });
                    mockEventEmitter.emit('Debugger.breakpointResolved', <Chrome.Debugger.BreakpointResolvedParams>{ breakpointId: BP_ID + 3, location: { scriptId: 'afterRefreshScriptId' } });

                    breakpoints.push({ line: 321, column: 123 });
                    expectSetBreakpoint(breakpoints, FILE_NAME, 'afterRefreshScriptId');
                    return chromeDebugAdapter.setBreakpoints({ source: { path: FILE_NAME }, breakpoints }, 0);
                })
                .then(response => assertExpectedResponse(response, breakpoints));
        });

        test('returns the actual location specified by the runtime', () => {
            const breakpoints: DebugProtocol.SourceBreakpoint[] = [
                { line: 5, column: 6 }
            ];

            // Set up the mock to return a different location
            const location: Chrome.Debugger.Location = {
                scriptId: SCRIPT_ID, lineNumber: breakpoints[0].line + 10, columnNumber: breakpoints[0].column + 10 };
            const expectedResponse: ISetBreakpointsResponseBody = {
                breakpoints: [{ line: location.lineNumber, column: location.columnNumber, verified: true, id: 1000 }]};

            mockChromeConnection
                .setup(x => x.debugger_setBreakpointByUrl(FILE_NAME, breakpoints[0].line, breakpoints[0].column, undefined))
                .returns(() => Promise.resolve(
                    <Chrome.Debugger.SetBreakpointByUrlResponse>{ id: 0, result: { breakpointId: BP_ID, locations: [location] } }))
                .verifiable();

            return chromeDebugAdapter.attach(ATTACH_ARGS)
                .then(() => emitScriptParsed())
                .then(() => chromeDebugAdapter.setBreakpoints({ source: { path: FILE_NAME }, breakpoints }, 0))
                .then(response => assert.deepEqual(response, expectedResponse));
        });

        test('setting breakpoints in a sourcemapped eval script handles the placeholder url', () => {
            const breakpoints: DebugProtocol.SourceBreakpoint[] = [
                { line: 5, column: 6 }
            ];
            expectSetBreakpoint(breakpoints);

            return chromeDebugAdapter.attach(ATTACH_ARGS)
                .then(() => emitScriptParsed(/*url=*/'', SCRIPT_ID))
                .then(() => chromeDebugAdapter.setBreakpoints({ source: { path: 'debugadapter://' + SCRIPT_ID }, breakpoints }, 0))
                .then(response => assertExpectedResponse(response, breakpoints));
        });
    });

    suite('Console.messageAdded', () => {
        test('Fires an output event when a console message is added', () => {
            const testLog = 'Hello, world!';
            let outputEventFired = false;
            chromeDebugAdapter.registerEventHandler((event: DebugProtocol.Event) => {
                if (event.event === 'output') {
                    outputEventFired = true;
                    assert.equal(event.body.text, testLog);
                } else {
                    testUtils.assertFail('An unexpected event was fired');
                }
            });

            mockEventEmitter.emit('Console.onMessageAdded', {
                message: {
                    source: 'console-api',
                    level: 'log',
                    type: 'log',
                    text: testLog,
                    timestamp: Date.now(),
                    line: 2,
                    column: 13,
                    url: 'file:///c:/page/script.js',
                    executionContextId: 2,
                    parameters: [
                        { type: 'string', value: testLog }
                    ]
                }
            });
        });
    });

    suite('Debugger.scriptParsed', () => {
        const FILE_NAME = 'file:///a.js';
        const SCRIPT_ID = '1';
        function emitScriptParsed(url = FILE_NAME, scriptId = SCRIPT_ID, otherArgs: any = {}): void {
            otherArgs.url = url;
            otherArgs.scriptId = scriptId;

            mockEventEmitter.emit('Debugger.scriptParsed', otherArgs);
        }

        test('adds default url when missing', () => {
            let scriptParsedFired = false;
            return chromeDebugAdapter.attach(ATTACH_ARGS).then(() => {
                mockPathTransformer.setup(m => m.scriptParsed(It.isAnyString()))
                    .returns(url => {
                        scriptParsedFired = true;
                        assert(!!url); // Should be called with some default url
                        return url;
                    });
                mockSourceMapTransformer.setup(m => m.scriptParsed(It.isAny(), It.isValue(undefined)))
                    .returns(() => Promise.resolve([]));

                emitScriptParsed(/*url=*/'');
                assert(scriptParsedFired);
            });
        });

        test('ignores internal scripts', () => {
            return chromeDebugAdapter.attach(ATTACH_ARGS).then(() => {
                chromeDebugAdapter.registerEventHandler((event: DebugProtocol.Event) => {
                    testUtils.assertFail('No event should be fired: ' + event.event);
                });

                emitScriptParsed(/*url=*/'', undefined, { isInternalScript: true });
            });
        });
    });

    suite('setExceptionBreakpoints()', () => { });
    suite('stepping', () => { });
    suite('stackTrace()', () => { });
    suite('scopes()', () => { });
    suite('variables()', () => { });
    suite('source()', () => { });
    suite('threads()', () => { });
    suite('evaluate()', () => { });

    suite('Debugger.resume', () => { });
    suite('Debugger.pause', () => { });
    suite('target close/error/detach', () => { });
});
