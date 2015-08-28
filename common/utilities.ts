/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as Path from 'path';

var _formatRegexp = /{(\d+)}/g;

export function format(format: string, ...param: any[]): string {
	return format.replace(_formatRegexp, function(match, paramIndex) { 
		return typeof param[paramIndex] != 'undefined' ? param[paramIndex] : match;
	});
}

var _formatPIIRegexp = /{([^}]+)}/g;

export function formatPII(format:string, excludePII: boolean, args: {[key: string]: string}): string {
	return format.replace(_formatPIIRegexp, function(match, paramName) {
		if (excludePII && paramName.length > 0 && paramName[0] !== '_') {
			return match;
		}
		return args[paramName] && args.hasOwnProperty(paramName) ?
			args[paramName] :
			match;
	})
}

export function random(low: number, high: number): number {
	return Math.floor(Math.random() * (high - low) + low);
}

export function isArray(what: any): boolean {
	return Object.prototype.toString.call(what) === '[object Array]';
}

export function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

export function getPathRoot(p: string) {
	if (p) {
		if (p.length >= 3 && p[1] == ':' && p[2] == '\\' && ((p[0] >= 'a' && p[0] <= 'z') || (p[0] >= 'A' && p[0] <= 'Z'))) {
			return p.substr(0, 3);
		}
		if (p.length > 0 && p[0] == '/') {
			return '/';
		}
	}
	return null;
}
	
	export function makePathAbsolute(absPath: string, relPath: string): string {		
		return Path.resolve(Path.dirname(absPath), relPath);
	}

export function removeFirstSegment(path: string) {
	if (path[0] == Path.sep) {
		path = path.substr(1);
	}
	var pos = path.indexOf(Path.sep);
	if (pos >= 0) {
		path = path.substr(pos + 1);
	} else {
		return null;
	}
	if (path.length > 0) {
		return path;
	}
	return null;	
}

export function makeRelative(target: string, path: string) {
	var t = target.split(Path.sep);
	var p = path.split(Path.sep);

	var i = 0;
	for (; i < Math.min(t.length, p.length) && t[i] == p[i]; i++) {
	}

	var result = '';
	for (; i < p.length; i++) {
		result = Path.join(result, p[i]);
	}
	return result;
}

export function extendObject<T> (objectCopy: T, object: T): T {

    for (var key in object) {
        if (object.hasOwnProperty(key)) {
            objectCopy[key] = object[key];
        }
    }

    return objectCopy;
}