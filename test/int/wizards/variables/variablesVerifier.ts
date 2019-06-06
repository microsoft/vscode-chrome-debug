/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as _ from 'lodash';
import { expect } from 'chai';
import { DebugProtocol } from 'vscode-debugprotocol';
import { trimWhitespaceAndComments } from '../breakpoints/implementation/printedTestInputl';
import { ManyVariablesValues, } from './variablesWizard';
import { printVariables } from './variablesPrinting';

/** Whether the expected variables should match exactly the actual variables of the debuggee
 * or whether the expected variables should only be a subset of the actual variables of the debuggee
 */
export enum KindOfVerification {
    SameAndExact, /** Same exact variables */
    ProperSubset /** Expected variables are a subset of the actual variables */
}

/**
 * Provide methods to validate that the variables appearing on the stack trace are what we expect
 */
export class VariablesVerifier {
    /** Verify that the actual variables are exactly the variables that we expect */
    public assertVariablesAre(variables: DebugProtocol.Variable[], expectedVariables: string | ManyVariablesValues): void {
        if (typeof expectedVariables === 'string') {
            this.assertVariablesPrintedAre(variables, expectedVariables);
        } else {
            this.assertVariablesValuesAre(variables, expectedVariables);
        }
    }

    private assertVariablesPrintedAre(variables: DebugProtocol.Variable[], expectedVariablesPrinted: string): void {
        const trimmedVariables = trimWhitespaceAndComments(expectedVariablesPrinted);
        expect(printVariables(variables)).to.equal(trimmedVariables);
    }

    private assertVariablesValuesAre(manyVariables: DebugProtocol.Variable[], expectedVariablesValues: ManyVariablesValues): void {
        return this.assertVariablesValuesSatisfy(manyVariables, expectedVariablesValues, KindOfVerification.SameAndExact);
    }

    /** Verify that the actual variables include as a proper subset the variables that we expect */
    public assertVariablesValuesContain(manyVariables: DebugProtocol.Variable[], expectedVariablesValues: ManyVariablesValues): void {
        return this.assertVariablesValuesSatisfy(manyVariables, expectedVariablesValues, KindOfVerification.ProperSubset);
    }

    /** Verify that the actual variables match the expected variables with the verification specified as a parameter (Same or subset) */
    public assertVariablesValuesSatisfy(
        manyVariables: DebugProtocol.Variable[], expectedVariablesValues: ManyVariablesValues,
        kindOfVerification: KindOfVerification): void {
        const actualVariableNames = manyVariables.map(variable => variable.name);
        const expectedVariablesNames = Object.keys(expectedVariablesValues);
        switch (kindOfVerification) {
            case KindOfVerification.ProperSubset:
                expect(actualVariableNames).to.contain.members(expectedVariablesNames);
                break;
            case KindOfVerification.SameAndExact:
                expect(actualVariableNames).to.have.members(expectedVariablesNames);
                break;
            default:
                throw new Error(`Unexpected comparison algorithm: ${kindOfVerification}`);
        }

        for (const variable of manyVariables) {
            const variableName = variable.name;
            if (expectedVariablesNames.indexOf(variableName) >= 0) {
                const expectedValue = expectedVariablesValues[variableName];
                expect(expectedValue).to.not.equal(undefined);
                expect(variable!.evaluateName).to.be.equal(variable!.name); // Is this ever different?
                expect(variable!.variablesReference).to.be.greaterThan(-1);
                expect(variable!.value).to.be.equal(`${expectedValue}`);
                // TODO: Validate variable type too
            } else {
                expect(kindOfVerification).to.equal(KindOfVerification.ProperSubset); // This should not happen for same elements
            }
        }
    }
}
