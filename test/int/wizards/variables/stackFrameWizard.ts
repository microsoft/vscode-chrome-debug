import { expect } from 'chai';
import { DebugProtocol } from 'vscode-debugprotocol';
import { THREAD_ID, ExtendedDebugClient } from 'vscode-chrome-debug-core-testsupport';
import { VariablesScopeName } from './variablesWizard';
import { ValidatedSet, IValidatedSet } from '../../core-v2/chrome/collections/validatedSet';
import { singleElementOfArray } from '../../core-v2/chrome/collections/utilities';
import { logger } from 'vscode-debugadapter';
interface IVariablesOfScope {
    scopeName: VariablesScopeName;
    variables: DebugProtocol.Variable[];
}

/** Utility functions to operate on the stack straces and stack frames of the debuggee.
 * It also provides utilities to access the scopes available in a particular stack frame.
 */
export class StackFrameWizard {
    public constructor(private readonly _client: ExtendedDebugClient, private readonly _stackFrame: DebugProtocol.StackFrame) { }

    /** Return a Wizard to interact with the top stack frame of the debuggee of the client */
    public static async topStackFrame(client: ExtendedDebugClient): Promise<StackFrameWizard> {
        const stackTraceResponse = await client.send('stackTrace', { threadId: THREAD_ID });
        expect(stackTraceResponse.success).to.equal(true);
        const stackFrames = stackTraceResponse.body.stackFrames;
        expect(stackFrames.length).to.be.greaterThan(0);
        return new StackFrameWizard(client, stackFrames[0]);
    }

    /** Return the variables information for the scopes selected by name */
    public async variablesOfScopes(manyScopeNames: VariablesScopeName[]): Promise<IVariablesOfScope[]> {
        const scopes = await this.scopesByNames(manyScopeNames);
        return Promise.all(scopes.map(async scope => {
            const variablesResponse = await this._client.variablesRequest({ variablesReference: scope!.variablesReference });
            expect(variablesResponse.success).to.equal(true);
            expect(variablesResponse.body).not.to.equal(undefined);
            const variables = variablesResponse.body.variables;
            expect(variables).not.to.equal(undefined);
            return { scopeName: <VariablesScopeName>scope.name.toLowerCase(), variables };
        }));
    }

    private async scopesByNames(manyScopeNames: VariablesScopeName[]): Promise<DebugProtocol.Scope[]> {
        const scopeNamesSet = new ValidatedSet(manyScopeNames.map(name => name.toLowerCase()));
        const requestedScopes = (await this.scopes()).filter(scope => scopeNamesSet.has(scope.name.toLowerCase()));
        expect(requestedScopes).to.have.lengthOf(manyScopeNames.length);
        return requestedScopes;
    }

    /** Return all the scopes available in the underlying stack frame */
    public async scopes(): Promise<DebugProtocol.Scope[]> {
        const scopesResponse = await this._client.scopesRequest({ frameId: this._stackFrame.id });
        logger.log(`Scopes: ${scopesResponse.body.scopes.map(s => s.name).join(', ')}`);
        return scopesResponse.body.scopes;
    }

    /** Return the names of all the global variables in the underlying stack frame */
    public async globalVariableNames(): Promise<IValidatedSet<string>> {
        const existingGlobalVariables = await this.variablesOfScope('global');
        return new ValidatedSet(existingGlobalVariables.map(variable => variable.name));
    }

    /** Return the variables information for a particular scope of the underlying stack frame */
    public async variablesOfScope(scopeName: VariablesScopeName): Promise<DebugProtocol.Variable[]> {
        return singleElementOfArray(await this.variablesOfScopes([scopeName])).variables;
    }
}
