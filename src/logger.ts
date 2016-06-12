/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
    Log,
    Error
}

export type ILogCallback = (msg: string, level: LogLevel) => void;

/** Logger singleton */
let _logger: Logger;
export function log(msg: string, level = LogLevel.Log, forceDiagnosticLogging = false): void {
    if (_logger) _logger.log(msg, level, forceDiagnosticLogging);
}

export function error(msg: string, forceDiagnosticLogging = true): void {
    log(msg, LogLevel.Error, forceDiagnosticLogging);
}

export function init(isServer: boolean, logCallback: ILogCallback, logFileDirectory?: string): void {
    if (!_logger) {
        _logger = new Logger(isServer, logCallback, logFileDirectory);

        if (isServer) {
            logVersionInfo();
        }
    }
}

/**
 * Enable diagnostic logging (for non-server mode).
 */
export function enableDiagnosticLogging(): void {
    if (_logger) {
        _logger.diagnosticLoggingEnabled = true;
        if (!_logger.isServer) {
            logVersionInfo();
        }
    }
}

function logVersionInfo(): void {
    log(`OS: ${os.platform()} ${os.arch()}`);
    log('Node version: ' + process.version);
    log('Adapter version: ' + require('../../package.json').version);
}

/**
 * Manages logging, whether to console.log, file, or VS Code console.
 */
class Logger {
    /** True when running in 'server' mode - i.e. running the project on its own, and the test app having 'debugServer' set. */
    public isServer: boolean;

    /** The directory in which to log vscode-chrome-debug.txt */
    private _logFileDirectory: string;

    /** True when logging is enabled outside of server mode */
    private _diagnosticLoggingEnabled: boolean;

    /** When not in server mode, the log msg is sent to this callback. */
    private _diagnosticLogCallback: ILogCallback;

    /** Write steam for log file */
    private _logFileStream: fs.WriteStream;

    public get diagnosticLoggingEnabled(): boolean { return this._diagnosticLoggingEnabled; }

    public set diagnosticLoggingEnabled(enabled: boolean) {
        this._diagnosticLoggingEnabled = enabled;

        // Open a log file in the specified location. Overwritten on each run.
        if (this._logFileDirectory) {
            const logPath = path.join(this._logFileDirectory, 'vscode-chrome-debug.txt');
            this._logFileStream = fs.createWriteStream(logPath);
            this._logFileStream.on('error', e => {
                this._sendLog(`Error involving log file at path: ${logPath}. Error: ${e.toString()}`, LogLevel.Error);
            });
        }
    }

    constructor(isServer: boolean, logCallback: ILogCallback, logFileDirectory?: string) {
        this.isServer = isServer;
        this._diagnosticLogCallback = logCallback;
        this._logFileDirectory = logFileDirectory;
    }

    /**
     * @param forceDiagnosticLogging - Writes to the diagnostic logging channel, even if diagnostic logging is not enabled.
     *      (For warnings/errors that appear whether logging is enabled or not.)
     */
    public log(msg: string, level: LogLevel, forceDiagnosticLogging: boolean): void {
        if (this.isServer || this.diagnosticLoggingEnabled || forceDiagnosticLogging) {
            this._sendLog(msg, level);
        }

        // If an error or something else, prepend with '[LogLevel]'
        if (level !== LogLevel.Log) {
            msg = `[${LogLevel[level]}] ${msg}`;
        }

        if (this._logFileStream) {
            this._logFileStream.write(msg + '\n');
        }
    }

    private _sendLog(msg: string, level: LogLevel): void {
        if (msg.length > 1500) msg = msg.substr(0, 1500) + ' [...]';

        // In server mode, console APIs are ok. Outside of server mode, VS Code is watching stdin/out, so never use console APIs.
        if (this.isServer) {
            (level === LogLevel.Log ? console.log : console.error)(msg);
        } else if (this._diagnosticLogCallback) {
            this._diagnosticLogCallback(msg, level);
        }
    }
}
