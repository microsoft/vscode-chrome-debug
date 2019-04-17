/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
/* tslint:disable:typedef */
// Copied from -core because I don't want to include test stuff in the npm package

import { EventEmitter } from 'events';
import { Mock, It, IMock } from 'typemoq';
import { CDTP as Crdp } from 'vscode-chrome-debug-core';

export interface IMockChromeConnectionAPI {
    apiObjects: Crdp.ProtocolApi;

    Browser: IMock<Crdp.BrowserApi>;
    Console: IMock<Crdp.ConsoleApi>;
    Debugger: IMock<Crdp.DebuggerApi>;
    Runtime: IMock<Crdp.RuntimeApi>;
    Inspector: IMock<Crdp.InspectorApi>;
    Network: IMock<Crdp.NetworkApi>;
    Page: IMock<Crdp.PageApi>;
    Log: IMock<Crdp.LogApi>;

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
        on(_eventName: 'messageAdded', _handler: Crdp.Console.MessageAddedEvent) { }
    };
}

type TypeOfDebuggerOn = Parameters<Crdp.DebuggerApi['on']>;

function getDebuggerStubs(mockEventEmitter: EventEmitter) {
    return {
        setBreakpoint() { },
        setBreakpointByUrl() { },
        removeBreakpoint() { },
        enable() { },
        evaluateOnCallFrame() { },
        setBlackboxPatterns() { return Promise.resolve(); },
        setAsyncCallStackDepth() { },

        on(eventName: TypeOfDebuggerOn[0], handler: TypeOfDebuggerOn[1]) { mockEventEmitter.on(`Debugger.${eventName}`, handler); }
    };
}

function getNetworkStubs() {
    return {
        enable() { },
        setCacheDisabled() { }
    };
}

type TypeOfRuntimeOn = Parameters<Crdp.RuntimeApi['on']>;

function getRuntimeStubs(mockEventEmitter: EventEmitter) {
    return {
        enable() { },
        evaluate() { },

        on(eventName: TypeOfRuntimeOn[0], handler: TypeOfRuntimeOn[1]) { mockEventEmitter.on(`Runtime.${eventName}`, handler); }
    };
}

type TypeOfInspectorOn = Parameters<Crdp.InspectorApi['on']>;

function getInspectorStubs(mockEventEmitter: EventEmitter) {
    return {
        on(eventName: TypeOfInspectorOn[0], handler: TypeOfInspectorOn[1]) { mockEventEmitter.on(`Inspector.${eventName}`, handler); }
    };
}

type TypeOfPageOn = Parameters<Crdp.PageApi['on']>;

function getPageStubs() {
    return {
        enable() { },
        on(_eventName: TypeOfPageOn[0], _handler: TypeOfPageOn[1]) { }
    };
}

function getLogStubs() {
    return {
        enable() { return Promise.resolve(); },
        on(_eventName: 'messageAdded', _handler: (params: Crdp.Console.MessageAddedEvent) => void) { }
    };
}

export function getMockChromeConnectionApi(): IMockChromeConnectionAPI {
    const mockEventEmitter = new EventEmitter();

    const mockConsole = Mock.ofInstance<Crdp.ConsoleApi>(<any>getConsoleStubs());
    mockConsole.callBase = true;
    mockConsole
        .setup(x => x.enable())
        .returns(() => Promise.resolve());

    const mockDebugger = Mock.ofInstance<Crdp.DebuggerApi>(<any>getDebuggerStubs(mockEventEmitter));
    mockDebugger.callBase = true;
    mockDebugger
        .setup(x => x.enable())
        .returns(() => Promise.resolve({ debuggerId: 'id' }));

    const mockNetwork = Mock.ofInstance<Crdp.NetworkApi>(<any>getNetworkStubs());
    mockNetwork.callBase = true;
    mockNetwork
        .setup(x => x.enable(It.isAny()))
        .returns(() => Promise.resolve());

    const mockRuntime = Mock.ofInstance<Crdp.RuntimeApi>(<any>getRuntimeStubs(mockEventEmitter));
    mockRuntime.callBase = true;
    mockRuntime
        .setup(x => x.enable())
        .returns(() => Promise.resolve());

    const mockInspector = Mock.ofInstance<Crdp.InspectorApi>(<any>getInspectorStubs(mockEventEmitter));
    mockInspector.callBase = true;

    const mockPage = Mock.ofInstance<Crdp.PageApi>(<any>getPageStubs());

    const mockBrowser = Mock.ofInstance<Crdp.BrowserApi>(<any>getBrowserStubs());
    mockBrowser.callBase = true;

    const mockLog = Mock.ofInstance<Crdp.LogApi>(<any>getLogStubs());
    mockLog.callBase = true;

    const chromeConnectionAPI: Crdp.ProtocolApi = <any>{
        Browser: mockBrowser.object,
        Console: mockConsole.object,
        Debugger: mockDebugger.object,
        Runtime: mockRuntime.object,
        Inspector: mockInspector.object,
        Network: mockNetwork.object,
        Page: mockPage.object,
        Log: mockLog.object
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
        Log: mockLog,

        mockEventEmitter
    };
}
