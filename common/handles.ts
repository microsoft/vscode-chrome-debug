/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

export class Handles<T> {
	
	private START_HANDLE = 1000;

	private _nextHandle : number;
	private _handleMap : any;

	public constructor() {
		this._nextHandle = this.START_HANDLE;
		this._handleMap = {};
	}

	public Reset(): void {
		this._nextHandle = this.START_HANDLE;
		this._handleMap = {};
	}

	public Create(value: T): number {
		var handle = this._nextHandle++;
		this._handleMap[handle.toString()] = value;
		return handle;
	}

	public Get(handle: number, dflt: T = null): T {
		var key = handle.toString();
		if (this._handleMap.hasOwnProperty(key)) {
			return this._handleMap[key];
		}
		return dflt;
	}
}
