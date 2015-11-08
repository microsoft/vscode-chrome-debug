/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from 'assert';

import * as testUtils from '../testUtils';
import * as ConsoleHelper from '../../webkit/consoleHelper';

suite('ConsoleHelper', () => {
    setup(() => {
        testUtils.setupUnhandledRejectionListener();
    });

    teardown(() => {
        testUtils.removeUnhandledRejectionListener();
    });

    function doAssert(message: WebKitProtocol.Console.Message, expectedText: string, expectedIsError = false): void {
        assert.deepEqual(ConsoleHelper.formatConsoleMessage(message), { text: expectedText, isError: expectedIsError });
    }

    suite('console.log()', () => {
        test('simple log', () => {
            doAssert(Console.makeLog('Hello'), 'Hello');
            doAssert(Console.makeLog('Hello', 123, 'world!'), 'Hello 123 world!');
        });

        test('basic format specifiers', () => {
            doAssert(Console.makeLog('%s, %d', 'test', 123), 'test, 123');
        });

        test('numeric format specifiers correctly', () => {
            doAssert(Console.makeLog('%d %i %f', 1.9, 324, 9.4), '1 324 9.4');
            doAssert(Console.makeLog('%d %i %f', -19, -32.5, -9.4), '-19 -33 -9.4');
            doAssert(Console.makeLog('%d %i %f', 'not', 'a', 'number'), 'NaN NaN NaN');
        });

        test('unmatched format specifiers', () => {
            doAssert(Console.makeLog('%s %s %s', 'test'), 'test %s %s');
            doAssert(Console.makeLog('%s %s end', 'test1', 'test2', 'test3'), 'test1 test2 end test3');
        });

        test('null/undefined cases', () => {
            doAssert(Console.makeLog('%s %s %s', null, undefined, 'test'), 'null undefined test');
            doAssert(Console.makeLog('test', null, undefined), 'test null undefined');
        });

        test('network error', () => {
            doAssert(Console.makeNetworkLog('neterror', 'myurl'), 'neterror (myurl)', true);
        });

        test('objects- waiting on VS Code bug 20343');
    });

    suite('console.assert()', () => {
        test(`Prints params and doesn't resolve format specifiers`, () => {
            doAssert(Console.makeAssert('Fail %s 123', 456), 'Assertion failed: Fail %s 123 456\n  myFn @/script/a.js:4', true);
        });
    });
});

/**
 * Build the webkit notifications objects for various console APIs.
 */
namespace Console {
    /**
     * Make a mock message of any type.
     * @param type - The type of the message
     * @param params - The list of parameters passed to the log function
     * @param overrideProps - An object of props that the message should have. The rest are filled in with defaults.
     */
    function makeMockMessage(type: string, params: any[], overrideProps?: any): WebKitProtocol.Console.Message {
        const message = {
            source: 'console-api',
            level: 'log',
            type,
            text: params[0],
            timestamp: Date.now(),
            line: 2,
            column: 13,
            url: 'file:///c:/page/script.js',
            executionContextId: 2,
            parameters: params.map(param => {
                const remoteObj = { type: typeof param, value: param };
                if (param === null) {
                    (<any>remoteObj).subtype = 'null';
                }

                return remoteObj;
            })
        };

        if (overrideProps) {
            for (var propName in overrideProps) {
                if (overrideProps.hasOwnProperty(propName)) {
                    message[propName] = overrideProps[propName];
                }
            }
        }

        return message;
    }

    export function makeLog(...params: any[]): WebKitProtocol.Console.Message {
        return makeMockMessage('log', params);
    }

    export function makeAssert(...params: any[]): WebKitProtocol.Console.Message {
        const fakeStackTrace = [{ url: '/script/a.js', lineNumber: 4, functionName: 'myFn' }];
        return makeMockMessage('assert', params, { level: 'error', stackTrace: fakeStackTrace });
    }

    export function makeNetworkLog(text: string, url: string): WebKitProtocol.Console.Message {
        return makeMockMessage('log', [text], { source: 'network', url, level: 'error' });
    }
}
