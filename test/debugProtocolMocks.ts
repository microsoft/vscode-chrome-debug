/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
/* tslint:disable:typedef */
// Copied from -core because I don't want to include test stuff in the npm package

import { EventEmitter } from 'events';
import { Mock, It } from 'typemoq';
import { Crdp } from 'vscode-chrome-debug-core';

export interface IMockChromeConnectionAPI {
    apiObjects: Crdp.CrdpClient;

    Browser: Mock<Crdp.BrowserClient>;
    Console: Mock<Crdp.ConsoleClient>;
    Debugger: Mock<Crdp.DebuggerClient>;
    Runtime: Mock<Crdp.RuntimeClient>;
    Inspector: Mock<Crdp.InspectorClient>;
    Network: Mock<Crdp.NetworkClient>;
    Page: Mock<Crdp.PageClient>;

    mockEventEmitter: EventEmitter;
}

function getBrowserStubs() {
    return {
        getVersion() { return Promise.resolve({}); }
    };
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
        setAsyncCallStackDepth() { },

        onPaused(handler) { mockEventEmitter.on('Debugger.paused', handler); },
        onResumed(handler) { mockEventEmitter.on('Debugger.resumed', handler); },
        onScriptParsed(handler) { mockEventEmitter.on('Debugger.scriptParsed', handler); },
        onBreakpointResolved(handler) { mockEventEmitter.on('Debugger.breakpointResolved', handler); },
    };
}

function getNetworkStubs() {
    return {
        enable() { },
        setCacheDisabled() { }
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
        enable() { },
        onFrameNavigated() { }
    };
}

export function getMockChromeConnectionApi(): IMockChromeConnectionAPI {
    const mockEventEmitter = new EventEmitter();

    const mockConsole = Mock.ofInstance<Crdp.ConsoleClient>(<any>getConsoleStubs());
    mockConsole.callBase = true;
    mockConsole
        .setup(x => x.enable())
        .returns(() => Promise.resolve());

    const mockDebugger = Mock.ofInstance<Crdp.DebuggerClient>(<any>getDebuggerStubs(mockEventEmitter));
    mockDebugger.callBase = true;
    mockDebugger
        .setup(x => x.enable())
        .returns(() => Promise.resolve(null));

    const mockNetwork = Mock.ofInstance<Crdp.NetworkClient>(<any>getNetworkStubs());
    mockNetwork.callBase = true;
    mockNetwork
        .setup(x => x.enable(It.isAny()))
        .returns(() => Promise.resolve());

    const mockRuntime = Mock.ofInstance<Crdp.RuntimeClient>(<any>getRuntimeStubs(mockEventEmitter));
    mockRuntime.callBase = true;
    mockRuntime
        .setup(x => x.enable())
        .returns(() => Promise.resolve());

    const mockInspector = Mock.ofInstance<Crdp.InspectorClient>(<any>getInspectorStubs(mockEventEmitter));
    mockInspector.callBase = true;

    const mockPage = Mock.ofInstance<Crdp.PageClient>(<any>getPageStubs());

    const mockBrowser = Mock.ofInstance<Crdp.BrowserClient>(<any>getBrowserStubs());
    mockBrowser.callBase = true;

    const chromeConnectionAPI: Crdp.CrdpClient = <any>{
        Browser: mockBrowser.object,
        Console: mockConsole.object,
        Debugger: mockDebugger.object,
        Runtime: mockRuntime.object,
        Inspector: mockInspector.object,
        Network: mockNetwork.object,
        Page: mockPage.object
    };

    return {
        apiObjects: chromeConnectionAPI,

        Browser: mockBrowser,
        Console: mockConsole,
        Debugger: mockDebugger,
        Runtime: mockRuntime,
        Inspector: mockInspector,
        Network: mockNetwork,
        Page: mockPage,

        mockEventEmitter
    };
}
