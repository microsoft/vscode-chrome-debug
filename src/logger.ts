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

export function init(isServer: boolean, logCallback: ILogCallback): void {
    if (!_logger) {
        _logger = new Logger(isServer, logCallback);

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
    /** True when logging is enabled outside of server mode */
    public diagnosticLoggingEnabled: boolean;

    /** True when running in 'server' mode - i.e. running the project on its own, and the test app having 'debugServer' set. */
    public isServer: boolean;

    /** When not in server mode, the log msg is sent to this callback. */
    private _diagnosticLogCallback: ILogCallback;

    /** Write steam for log file */
    private _logFileStream: fs.WriteStream;

    constructor(isServer: boolean, logCallback: ILogCallback) {
        this.isServer = isServer;
        this._diagnosticLogCallback = logCallback;

        // Create a log file under the extension's root. Overwritten on each run.
        const logPath = path.resolve(__dirname, '../../vscode-chrome-debug.log');
        this._logFileStream = fs.createWriteStream(logPath);
        this._logFileStream.on('error', e => {
            this._sendLog(`Error involving log file at path: ${logPath}. Error: ${e.toString()}`, LogLevel.Error);
        });
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

        // Always write to file by default?
        this._logFileStream.write(msg + '\n');
    }

    private _sendLog(msg: string, level: LogLevel): void {
        // In server mode, console APIs are ok. Outside of server mode, VS Code is watching stdin/out, so never use console APIs.
        if (this.isServer) {
            (level === LogLevel.Log ? console.log : console.error)(msg);
        } else if (this._diagnosticLogCallback) {
            this._diagnosticLogCallback(msg, level);
        }
    }
}
