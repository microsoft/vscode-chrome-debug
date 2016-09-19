/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as DebugProtocol from 'vscode-debugadapter';

import {ChromeDebugAdapter} from './chromeDebugAdapter';
import * as Chrome from './chromeDebugProtocol.d';

export interface IVariableContainer {
    objectId: string;
    expand(adapter: ChromeDebugAdapter, filter?: string, start?: number, count?: number): Promise<DebugProtocol.Variable[]>;
    setValue(adapter: ChromeDebugAdapter, name: string, value: string): Promise<string>;
}

export abstract class BaseVariableContainer implements IVariableContainer {
    constructor(public objectId: string) {
    }

    public expand(adapter: ChromeDebugAdapter, filter?: string, start?: number, count?: number): Promise<DebugProtocol.Variable[]> {
        return adapter.getVariablesForObjectId(this.objectId, filter, start, count);
    }

    public abstract setValue(adapter: ChromeDebugAdapter, name: string, value: string): Promise<string>;
}

export class PropertyContainer extends BaseVariableContainer {
    public setValue(adapter: ChromeDebugAdapter, name: string, value: string): Promise<string> {
        return adapter.setPropertyValue(this.objectId, name, value);
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
    public expand(adapter: ChromeDebugAdapter, filter?: string, start?: number, count?: number): Promise<DebugProtocol.Variable[]> {
        // No filtering in scopes right now
        return super.expand(adapter, 'all', start, count).then(variables => {
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
        return adapter.setVariableValue(this._frameId, this._scopeIndex, name, value);
    }
}

export function isIndexedPropName(name: string): boolean {
    return !isNaN(parseInt(name, 10));
}
