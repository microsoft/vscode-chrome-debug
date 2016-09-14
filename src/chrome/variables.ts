/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as DebugProtocol from 'vscode-debugadapter';

import {ChromeDebugAdapter} from './chromeDebugAdapter';
import * as Chrome from './chromeDebugProtocol.d';

import * as utils from '../utils';

export interface IVariableContainer {
    objectId: string;
    thisObj?: Chrome.Runtime.RemoteObject;
    expand(adapter: ChromeDebugAdapter, filter: string, start: number, count: number): Promise<DebugProtocol.Variable[]>;
    setValue(adapter: ChromeDebugAdapter, name: string, value: string): Promise<string>;
}

export abstract class BaseVariableContainer implements IVariableContainer {
    constructor(public objectId: string) {
    }

    public abstract expand(adapter: ChromeDebugAdapter, filter: string, start: number, count: number): Promise<DebugProtocol.Variable[]>;
    public abstract setValue(adapter: ChromeDebugAdapter, name: string, value: string): Promise<string>;
}

export class PropertyContainer extends BaseVariableContainer {
    public expand(adapter: ChromeDebugAdapter, filter: string, start: number, count: number): Promise<DebugProtocol.Variable[]> {
        return utils.errP('Not implemented');
    }

    public setValue(adapter: ChromeDebugAdapter, name: string, value: string): Promise<string> {
        return adapter._setPropertyValue(this.objectId, name, value);
    }
}

export class ScopeContainer extends BaseVariableContainer {
    public thisObj: Chrome.Runtime.RemoteObject;

    private _frameId: string;
    private _scopeIndex: number;

    public constructor(frameId: string, scopeIndex: number, objectId: string, thisObj?: Chrome.Runtime.RemoteObject) {
        super(objectId);
        this.thisObj = thisObj;
        this._frameId = frameId;
        this._scopeIndex = scopeIndex;
    }

    public expand(adapter: ChromeDebugAdapter, filter: string, start: number, count: number): Promise<DebugProtocol.Variable[]> {
        return utils.errP('Not implemented');
    }

    public setValue(adapter: ChromeDebugAdapter, name: string, value: string): Promise<string> {
        return adapter._setVariableValue(this._frameId, this._scopeIndex, name, value);
    }
}