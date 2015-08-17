/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

export function format(format: string, ...param: any[]): string {
	return format.replace(/{(\d+)}/g, function(match, ix) { 
		return typeof param[ix] != 'undefined' ? param[ix] : match;
	});
}

export function random(low: number, high: number): number {
	return Math.floor(Math.random() * (high - low) + low);
}

export function isArray(what: any): boolean {
	return Object.prototype.toString.call(what) === '[object Array]';
}
