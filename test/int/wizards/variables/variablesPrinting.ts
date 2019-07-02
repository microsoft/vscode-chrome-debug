/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IVariableInformation {
    name: string;
    value: string;
    type?: string;
}

/**
 * Print a collection of variable informations to make it easier to compare
 * the expected variables of a test, and the actual variables of the debuggee
 */
export function printVariables(variables: IVariableInformation[]): string {
    const variablesPrinted = variables.map(variable => printVariable(variable));
    return variablesPrinted.join('\n');
}

function printVariable(variable: IVariableInformation): string {
    return `${variable.name} = ${variable.value} (${(variable.type)})`;
}
