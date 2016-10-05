/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {ChromeDebugAdapter as CoreDebugAdapter, logger, utils as coreUtils, ISourceMapPathOverrides} from 'vscode-chrome-debug-core';
import {spawn, ChildProcess} from 'child_process';

import {ILaunchRequestArgs, IAttachRequestArgs} from './chromeDebugInterfaces';
import * as utils from './utils';

const DefaultWebsourceMapPathOverrides: ISourceMapPathOverrides = {
    'webpack:///*': '${webRoot}/*',
    'meteor://💻app/*': '${webRoot}/*',
};

export class ChromeDebugAdapter extends CoreDebugAdapter {
    private _chromeProc: ChildProcess;

    public launch(args: ILaunchRequestArgs): Promise<void> {
        args.sourceMapPathOverrides = args.sourceMapPathOverrides || DefaultWebsourceMapPathOverrides;
        return super.launch(args).then(() => {
            // Check exists?
            const chromePath = args.runtimeExecutable || utils.getBrowserPath();
            if (!chromePath) {
                return coreUtils.errP(`Can't find Chrome - install it or set the "runtimeExecutable" field in the launch config.`);
            }

            // Start with remote debugging enabled
            const port = args.port || 9222;
            const chromeArgs: string[] = ['--remote-debugging-port=' + port];

            // Also start with extra stuff disabled
            chromeArgs.push(...['--no-first-run', '--no-default-browser-check']);
            if (args.runtimeArgs) {
                chromeArgs.push(...args.runtimeArgs);
            }

            if (args.userDataDir) {
                chromeArgs.push('--user-data-dir=' + args.userDataDir);
            }

            let launchUrl: string;
            if (args.file) {
                launchUrl = coreUtils.pathToFileURL(args.file);
            } else if (args.url) {
                launchUrl = args.url;
            }

            if (launchUrl) {
                chromeArgs.push(launchUrl);
            }

            logger.log(`spawn('${chromePath}', ${JSON.stringify(chromeArgs) })`);
            this._chromeProc = spawn(chromePath, chromeArgs, {
                detached: true,
                stdio: ['ignore'],
            });
            this._chromeProc.unref();
            this._chromeProc.on('error', (err) => {
                const errMsg = 'Chrome error: ' + err;
                logger.error(errMsg);
                this.terminateSession(errMsg);
            });

            return this.doAttach(port, launchUrl, args.address);
        });
    }

    public attach(args: IAttachRequestArgs): Promise<void> {
        args.sourceMapPathOverrides = args.sourceMapPathOverrides || DefaultWebsourceMapPathOverrides;
        return super.attach(args);
    }

    public disconnect(): void {
        if (this._chromeProc) {
            this._chromeProc.kill('SIGINT');
            this._chromeProc = null;
        }

        return super.disconnect();
    }
}