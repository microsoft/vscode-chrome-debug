/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { DebugProtocol } from 'vscode-debugprotocol';
import { ChildProcess, fork, spawn, execSync, ForkOptions, SpawnOptions } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    ITelemetryPropertyCollector, logger, telemetry, utils as coreUtils,
    ILaunchResult, IDebuggeeLauncher, inject, injectable, TYPES, ISession, ConnectedCDAConfiguration
} from 'vscode-chrome-debug-core';
import * as nls from 'vscode-nls';
import { ILaunchRequestArgs } from '../chromeDebugInterfaces';
import * as errors from '../errors';
import * as utils from '../utils';

let localize = nls.loadMessageBundle();

interface IChromeLauncherLifetimeState {
    stop(): Promise<void>;
}

class NotYetLaunched implements IChromeLauncherLifetimeState {
    public stop(): Promise<void> {
        // no-op here because in the case that we attach to an existing instance the launcher will still be in this state
        return new Promise(a => a());
    }
}

class Stopped implements IChromeLauncherLifetimeState {
    public stop(): Promise<void> {
        throw new Error(`Can't stop the chrome process because it hasn been already stopped`);
    }
}

class LaunchedInWindowsWithPID implements IChromeLauncherLifetimeState {

    public constructor(private readonly _chromePID: number) {}

    public async stop(): Promise<void> {
        // Disconnect before killing Chrome, because running "taskkill" when it's paused sometimes doesn't kill it
        // TODO: super.disconnect(args);

        // Only kill Chrome if the 'disconnect' originated from vscode. If we previously terminated
        // due to Chrome shutting down, or devtools taking over, don't kill Chrome.
        let taskkillCmd = `taskkill /PID ${this._chromePID}`;
        logger.log(`Killing Chrome process by pid: ${taskkillCmd}`);
        try {
            execSync(taskkillCmd);
        } catch (e) {
            // The command will fail if process was not found. This can be safely ignored.
        }

        for (let i = 0; i < 10; i++) {
            // Check to see if the process is still running, with CSV output format
            let tasklistCmd = `tasklist /FI "PID eq ${this._chromePID}" /FO CSV`;
            logger.log(`Looking up process by pid: ${tasklistCmd}`);
            let tasklistOutput = execSync(tasklistCmd).toString();

            // If the process is found, tasklist will output CSV with one of the values being the PID. Exit code will be 0.
            // If the process is not found, tasklist will give a generic "not found" message instead. Exit code will also be 0.
            // If we see an entry in the CSV for the PID, then we can assume the process was found.
            if (!tasklistOutput.includes(`"${this._chromePID}"`)) {
                logger.log(`Chrome process with pid ${this._chromePID} is not running`);
                return;
            }

            // Give the process some time to close gracefully
            logger.log(`Chrome process with pid ${this._chromePID} is still alive, waiting...`);
            await new Promise<void>((resolve) => {
                setTimeout(resolve, 200);
            });
        }

        // At this point we can assume the process won't close on its own, so force kill it
        let taskkillForceCmd = `taskkill /F /PID ${this._chromePID}`;
        logger.log(`Killing Chrome process timed out. Killing again using force: ${taskkillForceCmd}`);
        try {
            execSync(taskkillForceCmd);
        } catch (e) { }
    }
}

class LaunchedAsChildProcess implements IChromeLauncherLifetimeState {
    public constructor(
        public readonly chromePID: number,
        private readonly _chromeProc: ChildProcess) {
    }

    public async stop(): Promise<void> {
        // Disconnect before killing Chrome, because running "taskkill" when it's paused sometimes doesn't kill it
        // TODO: super.disconnect(args);

        // Only kill Chrome if the 'disconnect' originated from vscode. If we previously terminated
        // due to Chrome shutting down, or devtools taking over, don't kill Chrome.
        logger.log('Killing Chrome process');
        this._chromeProc.kill('SIGINT');
    }
}

class LaunchedUnelevatedAndFailedToGetPID implements IChromeLauncherLifetimeState {
    public stop(): Promise<void> {
        throw new Error(`Can't stop the chrome process because the debugger failed to obtain the Chrome process ID when it was launched`);
    }
}

interface IExtendedInitializeRequestArguments extends DebugProtocol.InitializeRequestArguments {
    supportsLaunchUnelevatedProcessRequest?: boolean;
}

/**
 * Launch chrome (we initially launch the about:blank page)
 */
@injectable()
export class ChromeLauncher implements IDebuggeeLauncher {
    private _state: IChromeLauncherLifetimeState = new NotYetLaunched();

    constructor(
        @inject(TYPES.ISession) private readonly _session: ISession,
        @inject(TYPES.ConnectedCDAConfiguration) private readonly _configuration: ConnectedCDAConfiguration) { }

    public async launch(args: ILaunchRequestArgs, telemetryPropertyCollector: ITelemetryPropertyCollector): Promise<ILaunchResult> {
        let runtimeExecutable: string | null = null;
        if (args.shouldLaunchChromeUnelevated !== undefined) {
            telemetryPropertyCollector.addTelemetryProperty('shouldLaunchChromeUnelevated', args.shouldLaunchChromeUnelevated.toString());
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
        const chromeEnv: coreUtils.IStringDictionary<string> | null = args.env || null;
        const chromeWorkingDir: string | null = args.cwd || null;

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

        let launchUrl = this._configuration.userRequestedUrl;
        if (launchUrl && !args.noDebug) {
            // We store the launch file/url provided and temporarily launch and attach to about:blank page. Once we receive configurationDone() event, we redirect the page to this file/url
            // This is done to facilitate hitting breakpoints on load
            launchUrl = 'about:blank';
        }

        if (launchUrl) {
            chromeArgs.push(launchUrl);
        }

        this._state = await this.spawnChrome(runtimeExecutable, chromeArgs, chromeEnv, chromeWorkingDir, !!args.runtimeExecutable,
            !!args.shouldLaunchChromeUnelevated, telemetryPropertyCollector);

        return {
            address: args.address,
            port,
            url: launchUrl || args.urlFilter
        };
    }

    public async stop(): Promise<void> {
        await this._state.stop();
        this._state = new Stopped();
    }

    private async spawnChrome(
        chromePath: string, chromeArgs: string[], env: coreUtils.IStringDictionary<string> | null,
        cwd: string | null, usingRuntimeExecutable: boolean, shouldLaunchUnelevated: boolean, telemetryPropertyCollector: ITelemetryPropertyCollector): Promise<IChromeLauncherLifetimeState> {
        /* __GDPR__FRAGMENT__
           "StepNames" : {
              "LaunchTarget.LaunchExe" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
           }
         */
        // this.events.emitStepStarted('LaunchTarget.LaunchExe');
        const platform = coreUtils.getPlatform();
        if (platform === coreUtils.Platform.Windows && shouldLaunchUnelevated) {
            const doesHostSupportLaunchUnelevatedProcessRequest = (<IExtendedInitializeRequestArguments>this._configuration.clientCapabilities).supportsLaunchUnelevatedProcessRequest;
            telemetryPropertyCollector.addTelemetryProperty('doesHostSupportLaunchUnelevated', `${doesHostSupportLaunchUnelevatedProcessRequest}`);

            if (doesHostSupportLaunchUnelevatedProcessRequest) {
                return await this.spawnChromeUnelevatedWithClient(chromePath, chromeArgs);
            } else {
                return await this.spawnChromeUnelevatedWithWindowsScriptHost(chromePath, chromeArgs);
            }
        } else if (platform === coreUtils.Platform.Windows && !usingRuntimeExecutable) {
            const options: ForkOptions = {
                execArgv: [],
                silent: true
            };
            if (env) {
                options['env'] = this.getFullEnv(env);
            }
            if (cwd) {
                options['cwd'] = cwd;
            }

            const timeoutInMilliseconds = 5000; // 5 seconds
            return new Promise((resolved, rejected) => {
                const chromeProc = fork(getChromeSpawnHelperPath(), [chromePath, ...chromeArgs], options);
                chromeProc.unref();

                chromeProc.on('message', data => {
                    const pidStr = data.toString();
                    logger.log('got chrome PID: ' + pidStr);
                    const chromePID = parseInt(pidStr, 10);
                    resolved(new LaunchedInWindowsWithPID(chromePID));
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

                setTimeout(() => {
                    rejected(new Error(`Timed-out while waiting for the Chrome spawn helper to launch Chrome and notify the main process of Chrome process's PID`));
                }, timeoutInMilliseconds);
            });
        } else {
            logger.log(`spawn('${chromePath}', ${JSON.stringify(chromeArgs)})`);
            const options: SpawnOptions = {
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

            chromeProc.on('error', (err) => {
                const errMsg = 'Chrome error: ' + err;
                logger.error(errMsg);
                // this.terminateSession(errMsg);
            });

            chromeProc.unref();

            const _chromePID = chromeProc.pid;

            return new LaunchedAsChildProcess(_chromePID, chromeProc);
        }
    }

    private async spawnChromeUnelevatedWithWindowsScriptHost(chromePath: string, chromeArgs: string[]): Promise<IChromeLauncherLifetimeState> {
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
            return new LaunchedInWindowsWithPID(parseInt(pidStr, 10));
        }

        return new LaunchedUnelevatedAndFailedToGetPID();
    }

    private getFullEnv(customEnv: coreUtils.IStringDictionary<string>): coreUtils.IStringDictionary<string | undefined> {
        const env = {
            ...process.env,
            ...customEnv
        };

        Object.keys(env).filter(k => env[k] === null).forEach(key => delete env[key]);
        return env;
    }

    private async spawnChromeUnelevatedWithClient(chromePath: string, chromeArgs: string[]): Promise<IChromeLauncherLifetimeState> {
        const chromePID = await new Promise<number>((resolve, reject) => {
            this._session.sendRequest('launchUnelevated', {
                'process': chromePath,
                'args': chromeArgs
            }, 10000, (response) => {
                if (!response.success) {
                    reject(new Error(response.message));
                } else {
                    resolve(response.body.processId);
                }
            });
        });

        return new LaunchedInWindowsWithPID(chromePID);
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

async function findNewlyLaunchedChromeProcess(semaphoreFile: string): Promise<string | null> {
    const regexPattern = /processid\s+=\s+(\d+)\s*;/i;
    let lastAccessFileContent: string | null = null;
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
                if (match !== null) {
                    return match[1];
                } else {
                    throw new Error(`Expected semaphore file line "${matchedLines[0]}" to match ${regexPattern} yet not match was found`);
                }
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
