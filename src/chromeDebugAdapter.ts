/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as os from 'os';
import * as path from 'path';

import {ChromeDebugAdapter as CoreDebugAdapter, logger, utils as coreUtils, ISourceMapPathOverrides, stoppedEvent} from 'vscode-chrome-debug-core';
import {spawn, fork, ChildProcess} from 'child_process';
import Crdp from 'chrome-remote-debug-protocol';
import {DebugProtocol} from 'vscode-debugprotocol';

import {ILaunchRequestArgs, IAttachRequestArgs, ICommonRequestArgs} from './chromeDebugInterfaces';
import * as utils from './utils';

const DefaultWebSourceMapPathOverrides: ISourceMapPathOverrides = {
    'webpack:///./*': '${webRoot}/*',
    'webpack:///*': '*',
    'meteor://💻app/*': '${webRoot}/*',
};

export class ChromeDebugAdapter extends CoreDebugAdapter {
    private static PAGE_PAUSE_MESSAGE = 'Paused in Visual Studio Code';

    private _chromeProc: ChildProcess;
    private _overlayHelper: utils.DebounceHelper;

    public initialize(args: DebugProtocol.InitializeRequestArguments): DebugProtocol.Capabilities {
        this._overlayHelper = new utils.DebounceHelper(/*timeoutMs=*/200);
        const capabilities = super.initialize(args);
        capabilities.supportsRestartRequest = true;

        return capabilities;
    }

    public launch(args: ILaunchRequestArgs): Promise<void> {
        return super.launch(args).then(() => {
            // Check exists?
            const chromePath = args.runtimeExecutable || utils.getBrowserPath();
            if (!chromePath) {
                return coreUtils.errP(`Can't find Chrome - install it or set the "runtimeExecutable" field in the launch config.`);
            }

            // Start with remote debugging enabled
            const port = args.port || 9222;
            const chromeArgs: string[] = [];

            if (!args.noDebug) {
                chromeArgs.push('--remote-debugging-port=' + port);
            }

            // Also start with extra stuff disabled
            chromeArgs.push(...['--no-first-run', '--no-default-browser-check']);
            if (args.runtimeArgs) {
                chromeArgs.push(...args.runtimeArgs);
            }

            // Set a userDataDir by default, if not disabled with 'false' or already specified
            if (typeof args.userDataDir === 'undefined' && !args.runtimeExecutable) {
                args.userDataDir = path.join(os.tmpdir(), `vscode-chrome-debug-userdatadir_${port}`);
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

            this._chromeProc = spawnChrome(chromePath, chromeArgs);
            this._chromeProc.on('error', (err) => {
                const errMsg = 'Chrome error: ' + err;
                logger.error(errMsg);
                this.terminateSession(errMsg);
            });

            return args.noDebug ? undefined :
                this.doAttach(port, launchUrl || args.urlFilter, args.address, args.timeout);
        });
    }

    public attach(args: IAttachRequestArgs): Promise<void> {
        if (args.urlFilter) {
            args.url = args.urlFilter;
        }

        return super.attach(args);
    }

    public commonArgs(args: ICommonRequestArgs): void {
        if (!args.webRoot && args.pathMapping && args.pathMapping['/']) {
            // Adapt pathMapping['/'] as the webRoot when not set, since webRoot is explicitly used in many places
            args.webRoot = args.pathMapping['/'];
        }

        args.sourceMaps = typeof args.sourceMaps === 'undefined' || args.sourceMaps;
        args.sourceMapPathOverrides = getSourceMapPathOverrides(args.webRoot, args.sourceMapPathOverrides);
        args.skipFileRegExps = ['^chrome-extension:.*'];

        super.commonArgs(args);
    }

    protected doAttach(port: number, targetUrl?: string, address?: string, timeout?: number): Promise<void> {
        return super.doAttach(port, targetUrl, address, timeout).then(() => {
            // Don't return this promise, a failure shouldn't fail attach
            this.globalEvaluate({ expression: 'navigator.userAgent', silent: true })
                .then(
                    evalResponse => logger.log('Target userAgent: ' + evalResponse.result.value),
                    err => logger.log('Getting userAgent failed: ' + err.message))
                .then(() => {
                    const cacheDisabled = (<ICommonRequestArgs>this._launchAttachArgs).disableNetworkCache || false;
                    this.chrome.Network.setCacheDisabled({ cacheDisabled });
                });
        });
    }

    protected runConnection(): Promise<void>[] {
        return [
            ...super.runConnection(),
            this.chrome.Page.enable(),
            this.chrome.Network.enable({})
        ];
    }

    protected onPaused(notification: Crdp.Debugger.PausedEvent, expectingStopReason?: stoppedEvent.ReasonType): void {
        this._overlayHelper.doAndCancel(() => this.chrome.Page.configureOverlay({ message: ChromeDebugAdapter.PAGE_PAUSE_MESSAGE }).catch(() => { }));
        super.onPaused(notification, expectingStopReason);
    }

    protected threadName(): string {
        return 'Chrome';
    }

    protected onResumed(): void {
        this._overlayHelper.wait(() => this.chrome.Page.configureOverlay({ }).catch(() => { }));
        super.onResumed();
    }

    public disconnect(): void {
        if (this._chromeProc && !this._hasTerminated) {
            // Only kill Chrome if the 'disconnect' originated from vscode. If we previously terminated
            // due to Chrome shutting down, or devtools taking over, don't kill Chrome.
            this._chromeProc.kill('SIGINT');
        }

        this._chromeProc = null;

        return super.disconnect();
    }

    /**
     * Opt-in event called when the 'reload' button in the debug widget is pressed
     */
    public restart(): Promise<void> {
        return this.chrome.Page.reload({ ignoreCache: true });
    }
}

function getSourceMapPathOverrides(webRoot: string, sourceMapPathOverrides?: ISourceMapPathOverrides): ISourceMapPathOverrides {
    return sourceMapPathOverrides ? resolveWebRootPattern(webRoot, sourceMapPathOverrides, /*warnOnMissing=*/true) :
            resolveWebRootPattern(webRoot, DefaultWebSourceMapPathOverrides, /*warnOnMissing=*/false);
}

/**
 * Returns a copy of sourceMapPathOverrides with the ${webRoot} pattern resolved in all entries.
 */
export function resolveWebRootPattern(webRoot: string, sourceMapPathOverrides: ISourceMapPathOverrides, warnOnMissing: boolean): ISourceMapPathOverrides {
    const resolvedOverrides: ISourceMapPathOverrides = {};
    for (let pattern in sourceMapPathOverrides) {
        const replacePattern = sourceMapPathOverrides[pattern];
        resolvedOverrides[pattern] = replacePattern;

        const webRootIndex = replacePattern.indexOf('${webRoot}');
        if (webRootIndex === 0) {
            if (webRoot) {
                resolvedOverrides[pattern] = replacePattern.replace('${webRoot}', webRoot);
            } else if (warnOnMissing) {
                logger.log('Warning: sourceMapPathOverrides entry contains ${webRoot}, but webRoot is not set');
            }
        } else if (webRootIndex > 0) {
            logger.log('Warning: in a sourceMapPathOverrides entry, ${webRoot} is only valid at the beginning of the path');
        }
    }

    return resolvedOverrides;
}

function spawnChrome(chromePath: string, chromeArgs: string[]): ChildProcess {
    if (coreUtils.getPlatform() === coreUtils.Platform.Windows) {
        const spawnChromePath = path.resolve(__dirname, 'src/chromeSpawnHelper.js');
        logger.log('Spawning chromeSpawnHelper.js');
        const chromeProc = spawn(process.execPath, [spawnChromePath, chromePath, ...chromeArgs]);
        chromeProc.on('error', (err) => {
            const errMsg = 'chromeSpawnHelper error: ' + err;
            logger.error(errMsg);
        });

        chromeProc.stderr.on('data', data => {
            logger.error('[chromeSpawnHelper] ' + data.toString());
        });

        chromeProc.stdout.on('data', data => {
            logger.log('[chromeSpawnHelper] ' + data.toString());
        });

        return chromeProc;
    } else {
        logger.log(`spawn('${chromePath}', ${JSON.stringify(chromeArgs) })`);
        const chromeProc = spawn(chromePath, chromeArgs, {
            detached: true,
            stdio: ['ignore'],
        });
        chromeProc.unref();
        return chromeProc;
    }
}
