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
    Page: Mock<Crdp.PageClient>;

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
        setBlackboxPatterns() { return Promise.resolve(); },

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
        onExecutionContextsCleared(handler) { mockEventEmitter.on('Runtime.executionContextsCleared', handler); },
        onExceptionThrown(handler) { mockEventEmitter.on('Runtime.onExceptionThrown', handler); }
    };
}

function getInspectorStubs(mockEventEmitter) {
    return {
        onDetached(handler) { mockEventEmitter.on('Inspector.detach', handler); }
    };
}

function getPageStubs() {
    return {
        enable() { }
    }
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

    let mockPage = Mock.ofInstance<Crdp.PageClient>(<any>getPageStubs());

    const chromeConnectionAPI: Crdp.CrdpClient = <any>{
        Console: mockConsole.object,
        Debugger: mockDebugger.object,
        Runtime: mockRuntime.object,
        Inspector: mockInspector.object,
        Page: mockPage.object
    };

    return {
        apiObjects: chromeConnectionAPI,

        Console: mockConsole,
        Debugger: mockDebugger,
        Runtime: mockRuntime,
        Inspector: mockInspector,
        Page: mockPage,

        mockEventEmitter
    };
}
