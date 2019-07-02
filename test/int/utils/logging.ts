import * as path from 'path';
import { logger, } from 'vscode-debugadapter';
import { LogLevel } from 'vscode-debugadapter/lib/logger';
import { MethodsCalledLogger, IMethodsCalledLoggerConfiguration, MethodsCalledLoggerConfiguration, ReplacementInstruction, wrapWithMethodLogger } from '../core-v2/chrome/logging/methodsCalledLogger';

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

/**
 * Transforms a title to an equivalent title that can be used as a filename (We use this to convert the name of our tests into the name of the logfile for that test)
 */
function sanitizeTestTitle(testTitle: string) {
    return testTitle
    .replace(/[:\/\\]/g, '-')

    // These replacements are needed for the hit count breakpoint tests, which have these characters in their title
    .replace(/ > /g, ' bigger than ')
    .replace(/ < /g, ' smaller than ')
    .replace(/ >= /g, ' bigger than or equal to ')
    .replace(/ <= /g, ' smaller than or equal to ');
}

function logFilePath(testTitle: string, logType: string) {
    return path.join(logsFolderPath, `${process.platform}-${sanitizeTestTitle(testTitle)}-${logType}${dateTimeForFilePathIfNeeded()}.log`);
}

logger.init(() => { });

// Dispose the logger on unhandled errors, so it'll flush the remaining contents of the log...
process.on('uncaughtException', () => logger.dispose());
process.on('unhandledRejection', () => logger.dispose());

let currentTestTitle = '';
export function setTestLogName(testTitle: string): void {
    // We call setTestLogName in the common setup code. We want to call it earlier in puppeteer tests to get the logs even when the setup fails
    // So we write this code to be able to call it two times, and the second time will get ignored
    if (testTitle !== currentTestTitle) {
        logger.setup(LogLevel.Verbose, logFilePath(testTitle, 'TEST'));
        testTitle = currentTestTitle;
    }
}

class PuppeteerMethodsCalledLoggerConfiguration implements IMethodsCalledLoggerConfiguration {
    private readonly _wrapped = new MethodsCalledLoggerConfiguration('', []);
    public readonly replacements: ReplacementInstruction[] = [];

    public customizeResult<T>(methodName: string | symbol | number, args: any, result: T): T {
        if (methodName === 'waitForSelector' && typeof result === 'object' && args.length >= 1) {
            return wrapWithMethodLogger(<T & object>result, args[0]);
        } else {
            return result;
        }
    }

    public customizeArgumentsBeforeCall(receiverName: string, methodName: string | symbol | number, args: object[]): void {
        this._wrapped.customizeArgumentsBeforeCall(receiverName, methodName, args);
    }
}

export function logCallsTo<T extends object>(object: T, name: string): T {
    return new MethodsCalledLogger(new PuppeteerMethodsCalledLoggerConfiguration(), object, name).wrapped();
}
