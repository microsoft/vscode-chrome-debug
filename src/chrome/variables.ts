/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as DebugProtocol from 'vscode-debugadapter';

import {Handles} from 'vscode-debugadapter';

import {ChromeDebugAdapter} from './chromeDebugAdapter';
import * as Chrome from './chromeDebugProtocol.d';

import * as utils from '../utils';

export interface IVariableContainer {
    objectId: string;
    expand(adapter: ChromeDebugAdapter, filter: string, start: number, count: number): Promise<DebugProtocol.Variable[]>;
    setValue(adapter: ChromeDebugAdapter, name: string, value: string): Promise<string>;
}

export abstract class BaseVariableContainer implements IVariableContainer {
    constructor(public objectId: string) {
    }

    public expand(adapter: ChromeDebugAdapter, filter: string, start: number, count: number): Promise<DebugProtocol.Variable[]> {
        return adapter.getVariablesForObjectId(this.objectId).then(variables => {
            let filteredVars: DebugProtocol.Variable[] = [];
            if (filter === 'indexed' && typeof start === 'number' && typeof count === 'number') {
                for (let i = start; i < (count + start) && i < variables.length; i++) filteredVars[i] = variables[i];
            } else {
                filteredVars = variables;
            }

            return filteredVars;
        });
    }

    public abstract setValue(adapter: ChromeDebugAdapter, name: string, value: string): Promise<string>;
}

export class PropertyContainer extends BaseVariableContainer {
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

    /**
     * Call super then insert the 'this' object if needed
     */
    public expand(adapter: ChromeDebugAdapter, filter: string, start: number, count: number): Promise<DebugProtocol.Variable[]> {
        return super.expand(adapter, filter, start, count).then(variables => {
            if (this.thisObj) {
                // If this is a scope that should have the 'this', prop, insert it at the top of the list
                return adapter.propertyDescriptorToVariable(<any>{ name: 'this', value: this.thisObj }).then(thisObjVar => {
                    variables.unshift(thisObjVar);
                    return variables;
                });
            } else {
                return variables;
            }
        });
    }

    public setValue(adapter: ChromeDebugAdapter, name: string, value: string): Promise<string> {
        return adapter._setVariableValue(this._frameId, this._scopeIndex, name, value);
    }
}
