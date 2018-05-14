/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

import {ChromeDebugAdapter as CoreDebugAdapter, logger, utils as coreUtils, ISourceMapPathOverrides, ChromeDebugSession, telemetry, ITelemetryPropertyCollector } from 'vscode-chrome-debug-core';
import { spawn, ChildProcess, fork, execSync } from 'child_process';
import { Crdp } from 'vscode-chrome-debug-core';
import { DebugProtocol } from 'vscode-debugprotocol';

import { ILaunchRequestArgs, IAttachRequestArgs, ICommonRequestArgs, ISetExpressionArgs, VSDebugProtocolCapabilities, ISetExpressionResponseBody } from './chromeDebugInterfaces';
import * as utils from './utils';
import * as errors from './errors';

import * as nls from 'vscode-nls';
import { FinishedStartingUpEventArguments } from 'vscode-chrome-debug-core/lib/src/executionTimingsReporter';
let localize = nls.loadMessageBundle();

// Keep in sync with sourceMapPathOverrides package.json default
const DefaultWebSourceMapPathOverrides: ISourceMapPathOverrides = {
    'webpack:///./~/*': '${webRoot}/node_modules/*',
    'webpack:///./*': '${webRoot}/*',
    'webpack:///*': '*',
    'webpack:///src/*': '${webRoot}/*',
    'meteor://💻app/*': '${webRoot}/*'
};

export class ChromeDebugAdapter extends CoreDebugAdapter {
    private _pagePauseMessage = 'Paused in Visual Studio Code';

    private _chromeProc: ChildProcess;
    private _overlayHelper: utils.DebounceHelper;
    private _chromePID: number;
    private _userRequestedUrl: string;

    public initialize(args: DebugProtocol.InitializeRequestArguments): VSDebugProtocolCapabilities {
        this._overlayHelper = new utils.DebounceHelper(/*timeoutMs=*/200);
        const capabilities: VSDebugProtocolCapabilities = super.initialize(args);
        capabilities.supportsRestartRequest = true;
        capabilities.supportsSetExpression = true;
        capabilities.supportsLogPoints = true;

        if (args.locale) {
            localize = nls.config({ locale: args.locale })();
        }

        return capabilities;
    }

    public launch(args: ILaunchRequestArgs, telemetryPropertyCollector: ITelemetryPropertyCollector, seq?: number): Promise<void> {
        if (args.breakOnLoad && !args.breakOnLoadStrategy) {
            args.breakOnLoadStrategy = 'instrument';
        }

        return super.launch(args, telemetryPropertyCollector).then(async () => {
            let runtimeExecutable: string;
            if (args.shouldLaunchChromeUnelevated !== undefined) {
                telemetryPropertyCollector.addTelemetryProperty('shouldLaunchChromeUnelevated', args.shouldLaunchChromeUnelevated.toString());
            }
            if (args.runtimeExecutable) {
                const re = findExecutable(args.runtimeExecutable);
                if (!re) {
                    return errors.getNotExistErrorResponse('runtimeExecutable', args.runtimeExecutable);
                }

                runtimeExecutable = re;
            }

            runtimeExecutable = runtimeExecutable || utils.getBrowserPath();
            if (!runtimeExecutable) {
                return coreUtils.errP(localize('attribute.chrome.missing', "Can't find Chrome - install it or set the \"runtimeExecutable\" field in the launch config."));
            }

            // Start with remote debugging enabled
            const port = args.port || 9222;
            const chromeArgs: string[] = [];
            const chromeEnv: {[key: string]: string} = args.env || null;
            const chromeWorkingDir: string = args.cwd || null;

            if (!args.noDebug) {
                chromeArgs.push('--remote-debugging-port=' + port);
            }

            // Also start with extra stuff disabled
            chromeArgs.push(...['--no-first-run', '--no-default-browser-check']);
            if (args.runtimeArgs) {
                chromeArgs.push(...args.runtimeArgs);
            }

            // Set a default userDataDir, if the user opted in explicitly with 'true' or if args.userDataDir is not set (only when runtimeExecutable is not set).
            // Can't set it automatically with runtimeExecutable because it may not be desired with Electron, other runtimes, random scripts.
            if (
                args.userDataDir === true ||
                (typeof args.userDataDir === 'undefined' && !args.runtimeExecutable)
            ) {
                args.userDataDir = path.join(os.tmpdir(), `vscode-chrome-debug-userdatadir_${port}`);
            }

            if (args.userDataDir) {
                chromeArgs.push('--user-data-dir=' + args.userDataDir);
            }

            if (args._clientOverlayPausedMessage) {
                this._pagePauseMessage = args._clientOverlayPausedMessage;
            }

            let launchUrl: string;
            if (args.file) {
                launchUrl = coreUtils.pathToFileURL(args.file);
            } else if (args.url) {
                launchUrl = args.url;
            }

            if (launchUrl && !args.noDebug) {
                // We store the launch file/url provided and temporarily launch and attach to about:blank page. Once we receive configurationDone() event, we redirect the page to this file/url
                // This is done to facilitate hitting breakpoints on load
                this._userRequestedUrl = launchUrl;
                launchUrl = 'about:blank';
            }

            if (launchUrl) {
                chromeArgs.push(launchUrl);
            }

            this._chromeProc = await this.spawnChrome(runtimeExecutable, chromeArgs, chromeEnv, chromeWorkingDir, !!args.runtimeExecutable,
                 args.shouldLaunchChromeUnelevated);
            if (this._chromeProc) {
                this._chromeProc.on('error', (err) => {
                    const errMsg = 'Chrome error: ' + err;
                    logger.error(errMsg);
                    this.terminateSession(errMsg);
                });
            }

            return args.noDebug ? undefined :
                this.doAttach(port, launchUrl || args.urlFilter, args.address, args.timeout, undefined, args.extraCRDPChannelPort);
        });
    }

    public attach(args: IAttachRequestArgs): Promise<void> {
        if (args.urlFilter) {
            args.url = args.urlFilter;
        }

        return super.attach(args);
    }

    protected hookConnectionEvents(): void {
        super.hookConnectionEvents();
        this.chrome.Page.on('frameNavigated', params => this.onFrameNavigated(params));
    }

    protected onFrameNavigated(params: Crdp.Page.FrameNavigatedEvent): void {
        if (this._userRequestedUrl) {
            const url = params.frame.url;
            const requestedUrlNoAnchor = this._userRequestedUrl.split('#')[0]; // Frame navigated url doesn't include the anchor
            if (url === requestedUrlNoAnchor || decodeURI(url) === requestedUrlNoAnchor) { // 'http://localhost:1234/test%20page' will use the not decoded version, 'http://localhost:1234/test page' will use the decoded version
                // Chrome started to navigate to the user's requested url
                this.events.emit(ChromeDebugSession.FinishedStartingUpEventName, { requestedContentWasDetected: true } as FinishedStartingUpEventArguments);
            } else if (url === 'chrome-error://chromewebdata/') {
                // Chrome couldn't retrieve the web-page in the requested url
                this.events.emit(ChromeDebugSession.FinishedStartingUpEventName, { requestedContentWasDetected: false, reasonForNotDetected: 'UnreachableURL'} as FinishedStartingUpEventArguments);
            } else if (url.startsWith('chrome-error://')) {
                // Uknown chrome error
                this.events.emit(ChromeDebugSession.FinishedStartingUpEventName, { requestedContentWasDetected: false, reasonForNotDetected: 'UnknownChromeError'} as FinishedStartingUpEventArguments);
            }
        }
    }

    public async configurationDone(): Promise<void> {
        if (this._userRequestedUrl) {
            // This means all the setBreakpoints requests have been completed. So we can navigate to the original file/url.
            this.chrome.Page.navigate({ url: this._userRequestedUrl }).then(() => {
                /* __GDPR__FRAGMENT__
                   "StepNames" : {
                      "RequestedNavigateToUserPage" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
                   }
                 */
                this.events.emitMilestoneReached('RequestedNavigateToUserPage');
            });
        }

        await super.configurationDone();
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

    protected doAttach(port: number, targetUrl?: string, address?: string, timeout?: number, websocketUrl?: string, extraCRDPChannelPort?: number): Promise<void> {
        return super.doAttach(port, targetUrl, address, timeout, websocketUrl, extraCRDPChannelPort).then(() => {
            // Don't return this promise, a failure shouldn't fail attach
            this.globalEvaluate({ expression: 'navigator.userAgent', silent: true })
                .then(
                    evalResponse => logger.log('Target userAgent: ' + evalResponse.result.value),
                    err => logger.log('Getting userAgent failed: ' + err.message))
                .then(() => {
                    const cacheDisabled = (<ICommonRequestArgs>this._launchAttachArgs).disableNetworkCache || false;
                    this.chrome.Network.setCacheDisabled({ cacheDisabled });
                });

            const versionInformationPromise = this.chrome.Browser.getVersion().then(
                response => {
                    const properties = {
                        'Versions.Target.CRDPVersion': response.protocolVersion,
                        'Versions.Target.Revision': response.revision,
                        'Versions.Target.UserAgent': response.userAgent,
                        'Versions.Target.V8': response.jsVersion
                    };

                    const parts = (response.product || '').split('/');
                    if (parts.length === 2) { // Currently response.product looks like "Chrome/65.0.3325.162" so we split the project and the actual version number
                        properties['Versions.Target.Project'] =  parts[0];
                        properties['Versions.Target.Version'] =  parts[1];
                    } else { // If for any reason that changes, we submit the entire product as-is
                        properties['Versions.Target.Product'] = response.product;
                    }
                    return properties;
                },
                err => {
                    logger.log('Getting userAgent failed: ' + err.message);
                    const properties = { 'Versions.Target.NoUserAgentReason': 'Error while retriving target user agent' } as telemetry.IExecutionResultTelemetryProperties;
                    coreUtils.fillErrorDetails(properties, err);
                    return properties;
                });

            // Send the versions information as it's own event so we can easily backfill other events in the user session if needed
            /* __GDPR__FRAGMENT__
               "VersionInformation" : {
                  "Versions.Target.CRDPVersion" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
                  "Versions.Target.Revision" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
                  "Versions.Target.UserAgent" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
                  "Versions.Target.V8" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
                  "Versions.Target.V<NUMBER>" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
                  "Versions.Target.Project" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
                  "Versions.Target.Version" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
                  "Versions.Target.Product" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
                  "Versions.Target.NoUserAgentReason" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
                  "${include}": [ "${IExecutionResultTelemetryProperties}" ]
               }
             */
            /* __GDPR__
               "target-version" : {
                  "${include}": [ "${DebugCommonProperties}" ]
               }
             */
            versionInformationPromise.then(versionInformation => telemetry.telemetry.reportEvent('target-version', versionInformation));

            /* __GDPR__FRAGMENT__
                "DebugCommonProperties" : {
                    "${include}": [ "${VersionInformation}" ]
                }
            */
            telemetry.telemetry.addCustomGlobalProperty(versionInformationPromise);
        });
    }

    protected runConnection(): Promise<void>[] {
        return [
            ...super.runConnection(),
            this.chrome.Page.enable(),
            this.chrome.Network.enable({})
        ];
    }

    protected async onPaused(notification: Crdp.Debugger.PausedEvent, expectingStopReason = this._expectingStopReason): Promise<void> {
        this._overlayHelper.doAndCancel(() => {

        return this._domains.has('Overlay') ?
            this.chrome.Overlay.setPausedInDebuggerMessage({ message: this._pagePauseMessage }).catch(() => { }) :
            (<any>this.chrome).Page.configureOverlay({ message: this._pagePauseMessage }).catch(() => { });
        });

        return super.onPaused(notification, expectingStopReason);
    }

    protected threadName(): string {
        return 'Chrome';
    }

    protected onResumed(): void {
        this._overlayHelper.wait(() => {
            return this._domains.has('Overlay') ?
                this.chrome.Overlay.setPausedInDebuggerMessage({ }).catch(() => { }) :
                (<any>this.chrome).Page.configureOverlay({ }).catch(() => { });
        });
        super.onResumed();
    }

    public disconnect(args: DebugProtocol.DisconnectArguments): void {
        const hadTerminated = this._hasTerminated;

        // Disconnect before killing Chrome, because running "taskkill" when it's paused sometimes doesn't kill it
        super.disconnect(args);

        if ( (this._chromeProc || (!this._chromeProc && this._chromePID)) && !hadTerminated) {
            // Only kill Chrome if the 'disconnect' originated from vscode. If we previously terminated
            // due to Chrome shutting down, or devtools taking over, don't kill Chrome.
            if (coreUtils.getPlatform() === coreUtils.Platform.Windows && this._chromePID) {
                let taskkillCmd = `taskkill /PID ${this._chromePID}`;
                logger.log(`Killing Chrome process by pid: ${taskkillCmd}`);
                try {
                    // Run synchronously because this process may be killed before exec() would run
                    execSync(taskkillCmd);
                } catch (e) {
                    // Can fail if Chrome was already open, and the process with _chromePID is gone.
                    // Or if it already shut down for some reason.
                }
                // execSync above may succeed, but Chrome still might not shut down, for example if the web page promts the user about unsaved changes.
                // In that case, we need to use /F to force shutdown, but we risk Chrome not shutting down correctly.
                taskkillCmd = `taskkill /F /PID ${this._chromePID}`;
                logger.log(`Killing Chrome process by pid (using force in case the first attempt failed): ${taskkillCmd}`);
                try {
                    execSync(taskkillCmd);
                } catch (e) {}
            } else if (this._chromeProc) {
                logger.log('Killing Chrome process');
                this._chromeProc.kill('SIGINT');
            }
        }

        this._chromeProc = null;
    }

    /**
     * Opt-in event called when the 'reload' button in the debug widget is pressed
     */
    public restart(): Promise<void> {
        return this.chrome ?
            this.chrome.Page.reload({ ignoreCache: true }) :
            Promise.resolve();
    }

    private async spawnChrome(chromePath: string, chromeArgs: string[], env: {[key: string]: string},
                              cwd: string, usingRuntimeExecutable: boolean, shouldLaunchUnelevated: boolean): Promise<ChildProcess> {
        /* __GDPR__FRAGMENT__
           "StepNames" : {
              "LaunchTarget.LaunchExe" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
           }
         */
        this.events.emitStepStarted('LaunchTarget.LaunchExe');
        const platform = coreUtils.getPlatform();
        if (platform === coreUtils.Platform.Windows && shouldLaunchUnelevated) {
            const semaphoreFile = path.join(os.tmpdir(), 'launchedUnelevatedChromeProcess.id');
            if (fs.existsSync(semaphoreFile)) { // remove the previous semaphoreFile if it exists.
                fs.unlinkSync(semaphoreFile);
            }
            const chromeProc = fork(getChromeSpawnHelperPath(),
                [`${process.env.windir}\\System32\\cscript.exe`, path.join(__dirname, 'launchUnelevated.js'),
                semaphoreFile, chromePath, ...chromeArgs], {});

            chromeProc.unref();
            await new Promise<void>((resolve, reject) => {
                chromeProc.on('message', resolve);
            });

            const pidStr = await findNewlyLaunchedChromeProcess(semaphoreFile);

            if (pidStr) {
                logger.log(`Parsed output file and got Chrome PID ${pidStr}`);
                this._chromePID = parseInt(pidStr, 10);
            }

            // Cannot get the real Chrome process, so return null.
            return null;
        } else if (platform === coreUtils.Platform.Windows && !usingRuntimeExecutable) {
            const options = {
                execArgv: [],
                silent: true
            };
            if (env) {
                options['env'] = {
                    ...process.env,
                    ...env
                };
            }
            if (cwd) {
                options['cwd'] = cwd;
            }
            const chromeProc = fork(getChromeSpawnHelperPath(), [chromePath, ...chromeArgs], options);
            chromeProc.unref();

            chromeProc.on('message', data => {
                const pidStr = data.toString();
                logger.log('got chrome PID: ' + pidStr);
                this._chromePID = parseInt(pidStr, 10);
            });

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
            const options = {
                detached: true,
                stdio: ['ignore'],
            };
            if (env) {
                options['env'] = {
                    ...process.env,
                    ...env
                };
            }
            if (cwd) {
                options['cwd'] = cwd;
            }
            const chromeProc = spawn(chromePath, chromeArgs, options);
            chromeProc.unref();
            return chromeProc;
        }
    }

    public async setExpression(args: ISetExpressionArgs): Promise<ISetExpressionResponseBody> {
        const reconstructedExpression = `${args.expression} = ${args.value}`;
        const evaluateEventArgs: DebugProtocol.EvaluateArguments = {
            expression: reconstructedExpression,
            frameId: args.frameId,
            format: args.format,
            context: 'repl'
        };

        const evaluateResult = await this.evaluate(evaluateEventArgs);
        return {
            value: evaluateResult.result
        };
        // Beware that after the expression is changed, the variables on the current stackFrame will not
        // be updated, which means the return value of the Runtime.getProperties request will not contain
        // this change until the breakpoint is released(step over or continue).
        //
        // See also: https://bugs.chromium.org/p/chromium/issues/detail?id=820535
    }

}

function getSourceMapPathOverrides(webRoot: string, sourceMapPathOverrides?: ISourceMapPathOverrides): ISourceMapPathOverrides {
    return sourceMapPathOverrides ? resolveWebRootPattern(webRoot, sourceMapPathOverrides, /*warnOnMissing=*/true) :
            resolveWebRootPattern(webRoot, DefaultWebSourceMapPathOverrides, /*warnOnMissing=*/false);
}

/**
 * Returns a copy of sourceMapPathOverrides with the ${webRoot} pattern resolved in all entries.
 *
 * dynamically required by test
 */
export function resolveWebRootPattern(webRoot: string, sourceMapPathOverrides: ISourceMapPathOverrides, warnOnMissing: boolean): ISourceMapPathOverrides {
    const resolvedOverrides: ISourceMapPathOverrides = {};
    for (let pattern in sourceMapPathOverrides) {
        const replacePattern = replaceWebRootInSourceMapPathOverridesEntry(webRoot, pattern, warnOnMissing);
        const replacePatternValue = replaceWebRootInSourceMapPathOverridesEntry(webRoot, sourceMapPathOverrides[pattern], warnOnMissing);

        resolvedOverrides[replacePattern] = replacePatternValue;
    }

    return resolvedOverrides;
}

function replaceWebRootInSourceMapPathOverridesEntry(webRoot: string, entry: string, warnOnMissing: boolean): string {
    const webRootIndex = entry.indexOf('${webRoot}');
    if (webRootIndex === 0) {
        if (webRoot) {
            return entry.replace('${webRoot}', webRoot);
        } else if (warnOnMissing) {
            logger.log('Warning: sourceMapPathOverrides entry contains ${webRoot}, but webRoot is not set');
        }
    } else if (webRootIndex > 0) {
        logger.log('Warning: in a sourceMapPathOverrides entry, ${webRoot} is only valid at the beginning of the path');
    }

    return entry;
}

function getChromeSpawnHelperPath(): string {
    return path.join(__dirname, 'chromeSpawnHelper.js');
}

function findExecutable(program: string): string | undefined {
    if (process.platform === 'win32' && !path.extname(program)) {
        const PATHEXT = process.env['PATHEXT'];
        if (PATHEXT) {
            const executableExtensions = PATHEXT.split(';');
            for (const extension of executableExtensions) {
                const programPath = program + extension;
                if (fs.existsSync(programPath)) {
                    return programPath;
                }
            }
        }
    }

    if (fs.existsSync(program)) {
        return program;
    }

    return undefined;
}

async function findNewlyLaunchedChromeProcess(semaphoreFile: string): Promise<string> {
    const regexPattern = /processid\s+=\s+(\d+)\s*;/i;
    let lastAccessFileContent: string;
    for (let i = 0 ; i < 25; i++) {
        if (fs.existsSync(semaphoreFile)) {
            lastAccessFileContent = fs.readFileSync(semaphoreFile, {
                encoding: 'utf16le'
            }).toString();

            const lines = lastAccessFileContent.split('\n');

            const matchedLines = (lines || []).filter(line => line.match(regexPattern));
            if (matchedLines.length > 1) {
                throw new Error(`Unexpected semaphore file format ${lines}`);
            }

            if (matchedLines.length === 1) {
                const match = matchedLines[0].match(regexPattern);
                return match[1];
            }
            // else == 0, wait for 200 ms delay and try again.
        }
        await new Promise<void>((resolve) => {
            setTimeout(resolve, 200);
        });
    }

    const error = new Error(`Cannot acquire Chrome process id`);
    let telemetryProperties: any = {
        semaphoreFileContent: lastAccessFileContent
    };

    coreUtils.fillErrorDetails(telemetryProperties, error);

    /* __GDPR__
       "error" : {
          "semaphoreFileContent" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
          "${include}": [
              "${IExecutionResultTelemetryProperties}",
              "${DebugCommonProperties}"
            ]
       }
     */
    telemetry.telemetry.reportEvent('error', telemetryProperties);

    return null;
}