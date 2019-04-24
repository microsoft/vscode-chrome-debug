import * as path from 'path';
import { logger, } from 'vscode-debugadapter';
import { LogLevel } from 'vscode-debugadapter/lib/logger';
import { MethodsCalledLogger, IMethodsCalledLoggerConfiguration, MethodsCalledLoggerConfiguration, ReplacementInstruction } from '../core-v2/chrome/logging/methodsCalledLogger';

const useDateTimeInLog = false;
function dateTimeForFilePath(): string {
    return new Date().toISOString().replace(/:/g, '').replace('T', ' ').replace(/\.[0-9]+^/, '');
}

function dateTimeForFilePathIfNeeded() {
    return useDateTimeInLog ? `-${dateTimeForFilePath()}` : '';
}

const logsFolderPath = path.resolve(process.cwd(), 'logs');

export function getDebugAdapterLogFilePath(testTitle: string): string {
    return logFilePath(testTitle, 'DA');
}

function sanitizeTestTitle(testTitle: string) {
    return testTitle.replace(/[:\/\\]/g, '-');
}

function logFilePath(testTitle: string, logType: string) {
    return path.join(logsFolderPath, `${process.platform}-${sanitizeTestTitle(testTitle)}-${logType}${dateTimeForFilePathIfNeeded()}.log`);
}

logger.init(() => { });

export function setTestLogName(testTitle: string): void {
    logger.setup(LogLevel.Verbose, logFilePath(testTitle, 'TEST'));
}

class PuppeteerMethodsCalledLoggerConfiguration implements IMethodsCalledLoggerConfiguration {
    private readonly _wrapped = new MethodsCalledLoggerConfiguration([]);
    public readonly replacements: ReplacementInstruction[] = [];

    public decideWhetherToWrapMethodResult(methodName: string | symbol | number, args: any, _result: unknown, wrapWithName: (name: string) => void): void {
        if (methodName === 'waitForSelector') {
            wrapWithName(args[0]);
        }
    }

    public decideWhetherToWrapEventEmitterListener(receiverName: string, methodName: string | symbol | number, args: unknown[], wrapWithName: (name: string) => void): void {
        return this._wrapped.decideWhetherToWrapEventEmitterListener(receiverName, methodName, args, wrapWithName);
    }
}

export function logCallsTo<T extends object>(object: T, name: string): T {
    return new MethodsCalledLogger(new PuppeteerMethodsCalledLoggerConfiguration(), object, name).wrapped();
}
