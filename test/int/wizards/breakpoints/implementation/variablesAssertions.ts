import { expect } from 'chai';
import { ExtendedDebugClient } from 'vscode-chrome-debug-core-testsupport';
import { DebugProtocol } from 'vscode-debugprotocol';

export interface IVariablesVerification {
    [name: string]: string;
}

/**
 * Provide methods to validate that the variables appearing on the stack trace are what we expect
 */
export class VariablesAssertions {
    public constructor(
        private readonly _client: ExtendedDebugClient) { }

    /**
     * Verify that the stackFrame contains some variables with a specific value
     */
    public async assertStackTraceContains(stackFrame: DebugProtocol.StackFrame, variables: IVariablesVerification): Promise<void> {
        const scopesResponse = await this._client.scopesRequest({ frameId: stackFrame.id });
        const localsScope = scopesResponse.body.scopes.find(scope => scope.name === 'Locals');
        expect(localsScope).to.not.equal(undefined);
        const variablesResponse = await this._client.variablesRequest({ variablesReference: localsScope!.variablesReference });

        for (const variableName of Object.keys(variables)) {
            const variableValue = variables[variableName];
            const variable = variablesResponse.body.variables.find(v => v.evaluateName === variableName);
            expect(variable).to.not.be.equal(undefined);
            expect(variable!.value).to.be.equal(variableValue);
        }
    }
}