import * as _ from 'lodash';

export function printTopLevelObjectDescription(objectToPrint: unknown) {
    return printObjectDescription(objectToPrint, printFirstLevelProperties);
}

export function printObjectDescription(objectToPrint: unknown, fallbackPrintDescription = (obj: unknown) => `${obj}`) {
    let printed = `<logic to print this object doesn't exist>`;
    if (!objectToPrint) {
        printed = `${objectToPrint}`;
    } else if (typeof objectToPrint === 'object') {
        // Proxies throw an exception when toString is called, so we need to check this first
        if (typeof (<any>objectToPrint).on === 'function') {
            // This is a noice-json-rpc proxy
            printed = 'CDTP Proxy';
        } else {
            // This if is actually unnecesary, the previous if (!objectToPrint) { does the same thing. For some reason the typescript compiler cannot infer the type from that if
            // so we just write this code to leave the compiler happy
            // TODO: Sync with the typescript team and figure out how to remove this
            if (!objectToPrint) {
                printed = `${objectToPrint}`;
            } else {
                const toString = objectToPrint.toString();
                if (toString !== '[object Object]') {
                    printed = toString;
                } else if (isJSONObject(objectToPrint)) {
                    printed = JSON.stringify(objectToPrint);
                } else if (objectToPrint.constructor === Object) {
                    printed = fallbackPrintDescription(objectToPrint);
                } else {
                    printed = `${objectToPrint}(${objectToPrint.constructor.name})`;
                }
                }
        }
    } else if (typeof objectToPrint === 'function') {
        if (objectToPrint.name) {
            printed = objectToPrint.name;
        } else {
            const functionSourceCode = objectToPrint.toString();

            // Find param => or (param1, param2)
            const parenthesisIndex = _.findIndex(functionSourceCode, character => character === ')' || character === '=');
            const functionParameters = functionSourceCode.substr(functionSourceCode[0] === '(' ? 1 : 0, parenthesisIndex - 1);
            printed = `Anonymous function: ${functionParameters}`;
        }
    } else {
        printed = `${objectToPrint}`;
    }

    return printed;
}

function isJSONObject(objectToPrint: any): boolean {
    if (objectToPrint.constructor === Object) {
        const values = _.values(objectToPrint);
        return values.every(value => !value || value.constructor === Object);
    } else {
        return false;
    }
}

function printFirstLevelProperties(objectToPrint: any): string {
    const printedProeprties = Object.keys(objectToPrint).map(key => `${key}: ${printObjectDescription(objectToPrint[key])}`);
    return `{ ${printedProeprties.join(', ')} }`;
}
