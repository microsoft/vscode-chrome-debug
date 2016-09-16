/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as Path from 'path';
import * as URL from 'url';

/**
 * Helper code copied from vscode-node-debug that's only relevant for SourceMaps right now,
 * but should be merged with other url/path handling code, or removed.
 */

function makePathAbsolute(absPath: string, relPath: string): string {
    return Path.resolve(Path.dirname(absPath), relPath);
}

export class URI {
    private _uri: string;
    private _u: URL.Url;

    static file(path: string, base?: string) {

        if (!Path.isAbsolute(path)) {
            path = makePathAbsolute(base, path);
        }
        if (path[0] === '/') {
            path = 'file://' + path;
        } else {
            path = 'file:///' + path;
        }

        const u = new URI();
        u._uri = path;
        try {
            u._u = URL.parse(path);
        }
        catch (e) {
            throw new Error(e);
        }
        return u;
    }

    static parse(uri: string, base?: string) {

        if (uri.indexOf('http:') === 0 || uri.indexOf('https:') === 0 || uri.indexOf('file:') === 0 || uri.indexOf('data:') === 0 ) {
            const u = new URI();
            u._uri = uri;
            try {
                u._u = URL.parse(uri);
            }
            catch (e) {
                throw new Error(e);
            }
            return u;
        }
        return URI.file(uri, base);
    }

    constructor() {
    }

    uri(): string {
        return this._uri;
    }

    isFile(): boolean {
        return this._u.protocol === 'file:';
    }

    filePath(): string {
        let path = this._u.path;
        if (/^\/[a-zA-Z]\:\//.test(path)) {
            path = path.substr(1);    // remove additional '/'
        }
        return path;
    }

    isData() {
        return this._u.protocol === 'data:' && this._uri.indexOf('application/json') > 0 && this._uri.indexOf('base64') > 0;
    }

    data(): string {
        const pos = this._uri.lastIndexOf(',');
        if (pos > 0) {
            return this._uri.substr(pos+1);
        }
        return null;
    }

    isHTTP(): boolean {
        return this._u.protocol === 'http:' || this._u.protocol === 'https:';
    }
}
