/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as url from 'url';

export function formatConsoleMessage(m: WebKitProtocol.Console.Message): { text: string, isError: boolean } {
    let outputText: string;
    if (m.type === 'log') {
        outputText = resolveParams(m);
    } else if (m.type === 'assert') {
        outputText = 'Assertion failed';
        if (m.parameters && m.parameters.length) {
            outputText += ': ' + m.parameters.map(p => p.value).join(' ');
        }

        outputText += '\n' + stackTraceToString(m.stackTrace);
    } else if (m.type === 'startGroup' || m.type === 'startGroupCollapsed') {
        outputText = '‹Start group›';
        if (m.text) {
            // Or wherever the label is
            outputText += ': ' + m.text;
        }
    } else if (m.type === 'endGroup') {
        outputText = '‹End group›'
    }

    return { text: outputText, isError: m.level === 'error' };
}

function resolveParams(m: WebKitProtocol.Console.Message): string {
    let text = m.text;
    if (!m.parameters || m.parameters.length === 1) {
        return text;
    }

    m.parameters.shift(); // The first param is 'text'

    // Find all %s, %i, etc. Strip %
    let formatSpecifiers = text.match(/\%[sidfoOc]/g) || [];
    formatSpecifiers = formatSpecifiers.map(spec => spec[1]);

    // Append all parameters, formatting properly if there's a format specifier
    m.parameters.forEach((param, i) => {
        let formatted: any;
        if (formatSpecifiers[i] === 's') {
            formatted = param.value;
        } else if (['i', 'd'].indexOf(formatSpecifiers[i]) >= 0) {
            formatted = Math.floor(+param.value);
        } else if (formatSpecifiers[i] === 'f') {
            formatted = +param.value;
        } else if (['o', 'O', 'c'].indexOf(formatSpecifiers[i]) >= 0) {
            // um
            formatted = param.value;
        }

        // If this param had a format specifier, search and replace it with the formatted param.
        // Otherwise, append it to the end of the text
        if (formatSpecifiers[i]) {
            text = text.replace('%' + formatSpecifiers[i], formatted);
        } else {
            text += ' ' + param.value;
        }
    });

    return text;
}

function stackTraceToString(stackTrace: WebKitProtocol.Console.StackTrace): string {
    return stackTrace
        .map(frame => `${frame.functionName} @${url.parse(frame.url).pathname}:${frame.lineNumber}`)
        .join('\n');
}
