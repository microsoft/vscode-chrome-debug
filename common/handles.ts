/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

export class Handles<T> {
	
	private START_HANDLE = 1000;

	private _nextHandle : number;
	private _handleMap : { [index: number]: T };

	public constructor() {
		this._nextHandle = this.START_HANDLE;
		this._handleMap = [];
	}

	public Reset(): void {
		this._nextHandle = this.START_HANDLE;
		this._handleMap = [];
	}

	public Create(value: T): number {
		var handle = this._nextHandle++;
		this._handleMap[handle] = value;
		return handle;
	}

	public Get(handle: number, dflt?: T): T {
		var v= this._handleMap[handle];
		if (v) {
			return v;
		}
		return dflt;
	}
}
