/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as Path from 'path';
import * as URL from 'url';


export function getPathRoot(p: string) {
	if (p) {
		if (p.length >= 3 && p[1] === ':' && p[2] === '\\' && ((p[0] >= 'a' && p[0] <= 'z') || (p[0] >= 'A' && p[0] <= 'Z'))) {
			return p.substr(0, 3);
		}
		if (p.length > 0 && p[0] === '/') {
			return '/';
		}
	}
	return null;
}

export function makePathAbsolute(absPath: string, relPath: string): string {
	return Path.resolve(Path.dirname(absPath), relPath);
}

export function removeFirstSegment(path: string) {
	const segments = path.split(Path.sep);
	segments.shift();
	if (segments.length > 0) {
		return segments.join(Path.sep);
	}
	return null;
}

export function makeRelative(target: string, path: string) {
	const t = target.split(Path.sep);
	const p = path.split(Path.sep);

	let i = 0;
	for (; i < Math.min(t.length, p.length) && t[i] === p[i]; i++) {
	}

	let result = '';
	for (; i < p.length; i++) {
		result = Path.join(result, p[i]);
	}
	return result;
}

export function canonicalizeUrl(url: string): string {
	let u = URL.parse(url);
	let p = u.pathname;

	if (p.length >= 4 && p[0] === '/' && p[2] === ':' && p[3] === '/' && ((p[1] >= 'a' && p[1] <= 'z') || (p[1] >= 'A' && p[1] <= 'Z'))) {
		return p.substr(1);
	}
	return p;
}
