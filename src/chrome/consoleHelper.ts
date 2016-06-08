/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as url from 'url';
import * as ChromeUtils from './chromeUtils';
import * as Chrome from './chromeDebugProtocol';

export function formatConsoleMessage(m: Chrome.Console.Message): { text: string, isError: boolean } {
    let outputText: string;
    if (m.type === 'log') {
        outputText = resolveParams(m);
        if (m.source === 'network') {
            outputText += ` (${m.url})`;
        }
    } else if (m.type === 'assert') {
        outputText = 'Assertion failed';
        if (m.parameters && m.parameters.length) {
            outputText += ': ' + m.parameters.map(p => p.value).join(' ');
        }

        outputText += '\n' + stackTraceToString(m.stack);
    } else if (m.type === 'startGroup' || m.type === 'startGroupCollapsed') {
        outputText = '‹Start group›';
        if (m.text) {
            // Or wherever the label is
            outputText += ': ' + m.text;
        }
    } else if (m.type === 'endGroup') {
        outputText = '‹End group›';
    } else if (m.type === 'trace') {
        outputText = 'console.trace()\n' + stackTraceToString(m.stack);
    } else {
        // Some types we have to ignore
        outputText = 'Unimplemented console API: ' + m.type;
    }

    return { text: outputText, isError: m.level === 'error' };
}

function resolveParams(m: Chrome.Console.Message): string {
    if (!m.parameters || !m.parameters.length) {
        return m.text;
    }

    const textParam = m.parameters[0];
    let text = remoteObjectToString(textParam);
    m.parameters.shift();

    // Find all %s, %i, etc in the first parameter, which is always the main text. Strip %
    let formatSpecifiers: string[] = [];
    if (textParam.type === 'string') {
        formatSpecifiers = textParam.value.match(/\%[sidfoOc]/g) || [];
        formatSpecifiers = formatSpecifiers.map(spec => spec[1]);
    }

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
            text += ' ' + remoteObjectToString(param);
        }
    });

    return text;
}

function remoteObjectToString(obj: Chrome.Runtime.RemoteObject): string {
    const result = ChromeUtils.remoteObjectToValue(obj, /*stringify=*/false);
    if (result.variableHandleRef) {
        // The DebugProtocol console API doesn't support returning a variable reference, so do our best to
        // build a useful string out of this object.
        if (obj.subtype === 'array') {
            return arrayRemoteObjToString(obj);
        } else if (obj.preview && obj.preview.properties) {
            let props: string = obj.preview.properties
                .map(prop => {
                    let propStr = prop.name + ': ';
                    if (prop.type === 'string') {
                        propStr += `"${prop.value}"`;
                    } else {
                        propStr += prop.value;
                    }

                    return propStr;
                })
                .join(', ');

            if (obj.preview.overflow) {
                props += '…';
            }

            return `${obj.className} {${props}}`;
        }
    } else {
        return result.value;
    }
}

function arrayRemoteObjToString(obj: Chrome.Runtime.RemoteObject): string {
    if (obj.preview && obj.preview.properties) {
        let props: string = obj.preview.properties
            .map(prop => prop.value)
            .join(', ');

        if (obj.preview.overflow) {
            props += '…';
        }

        return `[${props}]`;
    } else {
        return obj.description;
    }
}

function stackTraceToString(stackTrace: Chrome.Runtime.StackTrace): string {
    return stackTrace.callFrames
        .map(frame => {
            const fnName = frame.functionName || (frame.url ? '(anonymous)' : '(eval)');
            const fileName = frame.url ? url.parse(frame.url).pathname : '(eval)';
            return `-  ${fnName} @${fileName}:${frame.lineNumber}`;
        })
        .join('\n');
}
