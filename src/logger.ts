/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as fs from 'fs';

export enum LogLevel {
    Verbose = 0,
    Log = 1,
    Error = 2
}

export type ILogCallback = (msg: string, level: LogLevel) => void;

interface ILogItem {
    msg: string;
    level: LogLevel;
}

/** Logger singleton */
let _logger: Logger;
let _pendingLogQ: ILogItem[] = [];
export function log(msg: string, forceDiagnosticLogging = false, level = LogLevel.Log): void {
    // [null, undefined] => string
    msg = msg + '';
    if (_pendingLogQ) {
        _pendingLogQ.push({ msg, level });
    } else {
        _logger.log(msg, level, forceDiagnosticLogging);
    }
}

export function verbose(msg: string): void {
    log(msg, undefined, LogLevel.Verbose);
}

export function error(msg: string, forceDiagnosticLogging = true): void {
    log(msg, forceDiagnosticLogging, LogLevel.Error);
}

/**
 * Set the logger's minimum level to log. Log messages are queued before this is
 * called the first time, because minLogLevel defaults to Error.
 */
export function setMinLogLevel(logLevel: LogLevel): void {
    if (_logger) {
        _logger.minLogLevel = logLevel;

        // Clear out the queue of pending messages
        if (_pendingLogQ) {
            const logQ = _pendingLogQ;
            _pendingLogQ = null;
            logQ.forEach(item => log(item.msg, undefined, item.level));
        }
    }
}

export function init(logCallback: ILogCallback, logFilePath?: string): void {
    // Re-init, create new global Logger
    _pendingLogQ = [];
    _logger = new Logger(logCallback, logFilePath);
    if (logFilePath) {
        log(`Verbose logs are written to ${logFilePath}`);
    }
}

/**
 * Manages logging, whether to console.log, file, or VS Code console.
 */
class Logger {
    /** The directory in which to log vscode-chrome-debug.txt */
    private _logFilePath: string;

    /** True when logging is enabled outside of server mode */
    private _minLogLevel: LogLevel;

    /** When not in server mode, the log msg is sent to this callback. */
    private _diagnosticLogCallback: ILogCallback;

    /** Write steam for log file */
    private _logFileStream: fs.WriteStream;

    public get minLogLevel(): LogLevel { return this._minLogLevel; }

    public set minLogLevel(logLevel: LogLevel) {
        this._minLogLevel = logLevel;

        // Open a log file in the specified location. Overwritten on each run.
        if (logLevel < LogLevel.Error && this._logFilePath) {
            this._logFileStream = fs.createWriteStream(this._logFilePath);
            this._logFileStream.on('error', e => {
                this.sendLog(`Error involving log file at path: ${this._logFilePath}. Error: ${e.toString()}`, LogLevel.Error);
            });
        }
    }

    constructor(logCallback: ILogCallback, logFilePath?: string) {
        this._diagnosticLogCallback = logCallback;
        this._logFilePath = logFilePath;

        this.minLogLevel = LogLevel.Error;
    }

    /**
     * @param forceDiagnosticLogging - Writes to the diagnostic logging channel, even if diagnostic logging is not enabled.
     *      (For warnings/errors that appear whether logging is enabled or not.)
     */
    public log(msg: string, level: LogLevel, forceDiagnosticLogging: boolean): void {
        this.sendLog(msg, level);

        // If an error, prepend with '[LogLevel]'
        if (level === LogLevel.Error) {
            msg = `[${LogLevel[level]}] ${msg}`;
        }

        if (this._logFileStream) {
            this._logFileStream.write(msg + '\n');
        }
    }

    private sendLog(msg: string, level: LogLevel): void {
        if (level < this.minLogLevel) return;

        // Truncate long messages, they can hang VS Code
        if (msg.length > 1500) msg = msg.substr(0, 1500) + '[...]';

        if (this._diagnosticLogCallback) {
            this._diagnosticLogCallback(msg, level);
        }
    }
}
