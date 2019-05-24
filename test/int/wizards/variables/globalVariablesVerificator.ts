/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { trimWhitespaceAndComments } from '../breakpoints/implementation/printedTestInputl';
import { printVariables } from './variablesPrinting';
import { IValidatedSet } from '../../core-v2/chrome/collections/validatedSet';
import { StackFrameWizard } from './stackFrameWizard';
import { ExtendedDebugClient } from 'vscode-chrome-debug-core-testsupport';
import { ManyVariablesPropertiesPrinted } from './variablesWizard';

/**
 * Verify that the global variables have the expected values.
 *
 * Given that it's quite challenging to predict which global variables will exist on a particular platform,
 * this class offers the option to provide a list of global variables names to ignore while doing the checks
 */
export class GlobalVariablesVerificator {
    public constructor(private readonly _client: ExtendedDebugClient) { }

    /** Verify that the global variables have the expected values, ignoring the variables in <namesOfGlobalsToIgnore> */
    public async assertGlobalsOfTopFrameAre(expectedGlobals: ManyVariablesPropertiesPrinted, namesOfGlobalsToIgnore: IValidatedSet<string>): Promise<void> {
        const globalsOnFrame = await (await this.topStackFrameHelper()).variablesOfScope('global');
        const nonIgnoredGlobals = globalsOnFrame.filter(global => !namesOfGlobalsToIgnore.has(global.name));
        const expectedGlobalsTrimmed = trimWhitespaceAndComments(expectedGlobals);
        expect(printVariables(nonIgnoredGlobals)).to.equal(expectedGlobalsTrimmed);
    }

    private async topStackFrameHelper(): Promise<StackFrameWizard> {
        return await StackFrameWizard.topStackFrame(this._client);
    }
}