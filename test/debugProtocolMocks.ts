/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
/* tslint:disable:typedef */
// Copied from -core because I don't want to include test stuff in the npm package

import {EventEmitter} from 'events';
import {Mock} from 'typemoq';
import Crdp from 'chrome-remote-debug-protocol';

export interface IMockChromeConnectionAPI {
    apiObjects: Crdp.CrdpClient;

    Console: Mock<Crdp.ConsoleClient>;
    Debugger: Mock<Crdp.DebuggerClient>;
    Runtime: Mock<Crdp.RuntimeClient>;
    Inspector: Mock<Crdp.InspectorClient>;

    mockEventEmitter: EventEmitter;
}

// See https://github.com/florinn/typemoq/issues/20
function getConsoleStubs() {
    return {
        enable() { },
        onMessageAdded() { }
    };
}

function getDebuggerStubs(mockEventEmitter) {
    return {
        setBreakpoint() { },
        setBreakpointByUrl() { },
        removeBreakpoint() { },
        enable() { },
        evaluateOnCallFrame() { },

        onPaused(handler) { mockEventEmitter.on('Debugger.paused', handler); },
        onResumed(handler) { mockEventEmitter.on('Debugger.resumed', handler); },
        onScriptParsed(handler) { mockEventEmitter.on('Debugger.scriptParsed', handler); },
        onBreakpointResolved(handler) { mockEventEmitter.on('Debugger.breakpointResolved', handler); },
    };
}

function getRuntimeStubs(mockEventEmitter) {
    return {
        enable() { },
        evaluate() { },

        onConsoleAPICalled(handler) { mockEventEmitter.on('Runtime.consoleAPICalled', handler); },
        onExecutionContextsCleared(handler) { mockEventEmitter.on('Runtime.executionContextsCleared', handler); }
    };
}

function getInspectorStubs(mockEventEmitter) {
    return {
        onDetached(handler) { mockEventEmitter.on('Inspector.detach', handler); }
    };
}

export function getMockChromeConnectionApi(): IMockChromeConnectionAPI {
    const mockEventEmitter = new EventEmitter();

    let mockConsole = Mock.ofInstance<Crdp.ConsoleClient>(<any>getConsoleStubs());
    mockConsole.callBase = true;
    mockConsole
        .setup(x => x.enable())
        .returns(() => Promise.resolve());

    let mockDebugger = Mock.ofInstance<Crdp.DebuggerClient>(<any>getDebuggerStubs(mockEventEmitter));
    mockDebugger.callBase = true;
    mockDebugger
        .setup(x => x.enable())
        .returns(() => Promise.resolve());

    let mockRuntime = Mock.ofInstance<Crdp.RuntimeClient>(<any>getRuntimeStubs(mockEventEmitter));
    mockRuntime.callBase = true;
    mockRuntime
        .setup(x => x.enable())
        .returns(() => Promise.resolve());

    let mockInspector = Mock.ofInstance<Crdp.InspectorClient>(<any>getInspectorStubs(mockEventEmitter));
    mockInspector.callBase = true;

    const chromeConnectionAPI: Crdp.CrdpClient = <any>{
        Console: mockConsole.object,
        Debugger: mockDebugger.object,
        Runtime: mockRuntime.object,
        Inspector: mockInspector.object
    };

    return {
        apiObjects: chromeConnectionAPI,

        Console: mockConsole,
        Debugger: mockDebugger,
        Runtime: mockRuntime,
        Inspector: mockInspector,

        mockEventEmitter
    };
}
