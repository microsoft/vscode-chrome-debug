/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { ChildProcess, fork, spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ITelemetryPropertyCollector, logger, telemetry, utils as coreUtils, ILaunchResult, IDebuggeeLauncher } from 'vscode-chrome-debug-core';
import * as nls from 'vscode-nls';
import { ILaunchRequestArgs } from './chromeDebugInterfaces';
import * as errors from './errors';
import * as utils from './utils';

let localize = nls.loadMessageBundle();

export class ChromeLauncher implements IDebuggeeLauncher {

    private _pagePauseMessage = 'Paused in Visual Studio Code';

    private _chromeProc: ChildProcess;
    private _overlayHelper: utils.DebounceHelper;
    private _chromePID: number;
    private _userRequestedUrl: string;
    private _doesHostSupportLaunchUnelevatedProcessRequest: boolean;

    public async launch(args: ILaunchRequestArgs, telemetryPropertyCollector: ITelemetryPropertyCollector): Promise<ILaunchResult> {
        let runtimeExecutable: string;
        if (args.shouldLaunchChromeUnelevated !== undefined) {
            telemetryPropertyCollector.addTelemetryProperty('shouldLaunchChromeUnelevated', args.shouldLaunchChromeUnelevated.toString());
        }
        if (this._doesHostSupportLaunchUnelevatedProcessRequest) {
            telemetryPropertyCollector.addTelemetryProperty('doesHostSupportLaunchUnelevated', 'true');
        }
        if (args.runtimeExecutable) {
            const re = findExecutable(args.runtimeExecutable);
            if (!re) {
                throw errors.getNotExistErrorResponse('runtimeExecutable', args.runtimeExecutable);
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
        const chromeEnv: coreUtils.IStringDictionary<string> = args.env || null;
        const chromeWorkingDir: string = args.cwd || null;

        if (!args.noDebug) {
            chromeArgs.push('--remote-debugging-port=' + port);
        }

        // Also start with extra stuff disabled
        chromeArgs.push(...['--no-first-run', '--no-default-browser-check']);
        if (args.runtimeArgs) {
            telemetryPropertyCollector.addTelemetryProperty('numberOfChromeCmdLineSwitchesBeingUsed', String(args.runtimeArgs.length));
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
            // this._userRequestedUrl = launchUrl;
            // launchUrl = 'about:blank';
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
                // this.terminateSession(errMsg);
            });
        }

        return {
            address: args.address,
            port,
            url: launchUrl || args.urlFilter
        };
    }

    waitForDebugeeToBeReady(): Promise<void> {
        throw new Error("Method not implemented.");
    }

    private async spawnChrome(chromePath: string, chromeArgs: string[], env: coreUtils.IStringDictionary<string>, cwd: string, usingRuntimeExecutable: boolean, shouldLaunchUnelevated: boolean): Promise<ChildProcess> {
        /* __GDPR__FRAGMENT__
           "StepNames" : {
              "LaunchTarget.LaunchExe" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
           }
         */
        // this.events.emitStepStarted('LaunchTarget.LaunchExe');
        const platform = coreUtils.getPlatform();
        if (platform === coreUtils.Platform.Windows && shouldLaunchUnelevated) {
            let chromePid: number;

            if (this._doesHostSupportLaunchUnelevatedProcessRequest) {
                chromePid = await this.spawnChromeUnelevatedWithClient(chromePath, chromeArgs);
            } else {
                chromePid = await this.spawnChromeUnelevatedWithWindowsScriptHost(chromePath, chromeArgs);
            }

            this._chromePID = chromePid;
            // Cannot get the real Chrome process, so return null.
            return null;
        } else if (platform === coreUtils.Platform.Windows && !usingRuntimeExecutable) {
            const options = {
                execArgv: [],
                silent: true
            };
            if (env) {
                options['env'] = this.getFullEnv(env);
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
            logger.log(`spawn('${chromePath}', ${JSON.stringify(chromeArgs)})`);
            const options = {
                detached: true,
                stdio: ['ignore'],
            };
            if (env) {
                options['env'] = this.getFullEnv(env);
            }
            if (cwd) {
                options['cwd'] = cwd;
            }
            const chromeProc = spawn(chromePath, chromeArgs, options);
            chromeProc.unref();

            this._chromePID = chromeProc.pid;

            return chromeProc;
        }
    }

    private async spawnChromeUnelevatedWithWindowsScriptHost(chromePath: string, chromeArgs: string[]): Promise<number> {
        const semaphoreFile = path.join(os.tmpdir(), 'launchedUnelevatedChromeProcess.id');
        if (fs.existsSync(semaphoreFile)) { // remove the previous semaphoreFile if it exists.
            fs.unlinkSync(semaphoreFile);
        }
        const chromeProc = fork(getChromeSpawnHelperPath(),
            [`${process.env.windir}\\System32\\cscript.exe`, path.join(__dirname, 'launchUnelevated.js'),
                semaphoreFile, chromePath, ...chromeArgs], {});

        chromeProc.unref();
        await new Promise<void>((resolve, _reject) => {
            chromeProc.on('message', resolve);
        });

        const pidStr = await findNewlyLaunchedChromeProcess(semaphoreFile);

        if (pidStr) {
            logger.log(`Parsed output file and got Chrome PID ${pidStr}`);
            return parseInt(pidStr, 10);
        }

        return null;
    }

    private getFullEnv(customEnv: coreUtils.IStringDictionary<string>): coreUtils.IStringDictionary<string> {
        const env = {
            ...process.env,
            ...customEnv
        };

        Object.keys(env).filter(k => env[k] === null).forEach(key => delete env[key]);
        return env;
    }

    private async spawnChromeUnelevatedWithClient(chromePath: string, chromeArgs: string[]): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            // this._session.sendRequest('launchUnelevated', {
            //     'process': chromePath,
            //     'args': chromeArgs
            // }, 10000, (response) => {
            //     if (!response.success) {
            //         reject(new Error(response.message));
            //     } else {
            //         resolve(response.body.processId);
            //     }
            // });
        });
    }

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
    for (let i = 0; i < 25; i++) {
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
