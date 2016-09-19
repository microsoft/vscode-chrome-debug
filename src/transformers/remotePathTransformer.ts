/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as path from 'path';
import * as fs from 'fs';

import {BasePathTransformer} from './basePathTransformer';

import * as utils from '../utils';
import * as errors from '../errors';
import {ISetBreakpointsArgs, IAttachRequestArgs, IStackTraceResponseBody} from '../debugAdapterInterfaces';

/**
 * Converts a local path from Code to a path on the target.
 */
export class RemotePathTransformer extends BasePathTransformer {
    private _localRoot: string;
    private _remoteRoot: string;

    private get shouldMapPaths(): boolean {
        return !!this._localRoot && !!this._remoteRoot;
    }

    public attach(args: IAttachRequestArgs): Promise<void> {
        // Validate that localRoot is absolute and exists
        let localRootP = Promise.resolve<void>();
        if (args.localRoot) {
            const localRoot = args.localRoot;
            if (!path.isAbsolute(localRoot)) {
                return Promise.reject(errors.attributePathRelative('localRoot', localRoot));
            }

            localRootP = new Promise<void>((resolve, reject) => {
                fs.exists(localRoot, exists => {
                    if (!exists) {
                        reject(errors.attributePathNotExist('localRoot', localRoot));
                    }

                    this._localRoot = localRoot;
                    resolve();
                });
            });
        }

        // Maybe validate that it's absolute, for either windows or unix
        this._remoteRoot = args.remoteRoot;

        return localRootP;
    }

    public setBreakpoints(args: ISetBreakpointsArgs): boolean {
        if (args.source.path) {
            args.source.path = this.localToRemote(args.source.path);
        }

        return super.setBreakpoints(args);
    }

    public scriptParsed(scriptPath: string): string {
        scriptPath = this.remoteToLocal(scriptPath);
        return super.scriptParsed(scriptPath);
    }

    public stackTraceResponse(response: IStackTraceResponseBody): void {
        response.stackFrames.forEach(frame => {
            const remotePath = frame.source.path;
            if (remotePath) {
                frame.source.path = this.remoteToLocal(remotePath);
            }
        });

        return super.stackTraceResponse(response);
    }

    private remoteToLocal(remotePath: string): string {
        if (!this.shouldMapPaths) return remotePath;

        // need / paths for path.relative, if this platform is posix
        remotePath = utils.forceForwardSlashes(remotePath);

        const relPath = path.relative(this._remoteRoot, remotePath);
        const localPath = path.join(this._localRoot, relPath);

        return utils.fixDriveLetterAndSlashes(localPath);
    }

    private localToRemote(localPath: string): string {
        if (!this.shouldMapPaths) return localPath;

        const relPath = path.relative(this._localRoot, localPath);
        const remotePath = path.join(this._remoteRoot, relPath);

        return utils.fixDriveLetterAndSlashes(remotePath);
    }
}
