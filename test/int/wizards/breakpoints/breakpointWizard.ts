import { Position } from '../../core-v2/chrome/internal/locations/location';
import { IBPActionWhenHit } from '../../core-v2/chrome/internal/breakpoints/bpActionWhenHit';
import { InternalFileBreakpointsWizard } from './implementation/internalFileBreakpointsWizard';
import { RemoveProperty } from '../../core-v2/typeUtils';
import { DebugProtocol } from 'vscode-debugprotocol';
import { IVerificationsAndAction } from './breakpointsWizard';

export class BreakpointWizard {
    private isBreakpointSet = false;

    public constructor(
        private readonly _internal: InternalFileBreakpointsWizard, public readonly position: Position,
        public readonly actionWhenHit: IBPActionWhenHit, public readonly name: string, public readonly boundPosition: Position) { }

    public get filePath(): string {
        return this._internal.filePath;
    }

    public async setThenWaitForVerifiedThenValidate(): Promise<BreakpointWizard> {
        await this.setWithoutVerifying();
        await this.waitUntilVerified();
        this.assertIsVerified();
        return this;
    }

    public async waitUntilVerified(): Promise<BreakpointWizard> {
        this.validateIsSet('waitUntilVerified');
        await this._internal.waitUntilVerified(this);
        return Promise.resolve(this);
    }

    public async setWithoutVerifying(): Promise<BreakpointWizard> {
        this.validateIsUnset('setWithoutVerifying');
        await this._internal.set(this);
        this.isBreakpointSet = true;
        return Promise.resolve(this);
    }

    public async unset(): Promise<BreakpointWizard> {
        this.validateIsSet('unset');
        await this._internal.unset(this);
        this.isBreakpointSet = false;
        return Promise.resolve(this);
    }

    public async assertIsHitThenResumeWhen(lastActionToMakeBreakpointHit: () => Promise<unknown>, verifications: IVerificationsAndAction = {}): Promise<BreakpointWizard> {
        this.validateIsSet('assertIsHitThenResumeWhen');
        await this._internal.assertIsHitThenResumeWhen(this, lastActionToMakeBreakpointHit, verifications);
        return Promise.resolve(this);
    }

    public async assertIsHitThenResume(verifications: IVerificationsAndAction): Promise<BreakpointWizard> {
        this.validateIsSet('assertIsHitThenResume');
        await this._internal.assertIsHitThenResume(this, verifications);
        return Promise.resolve(this);
    }

    public assertIsVerified(): this {
        this.validateIsSet('assertIsVerified');
        this._internal.assertIsVerified(this);
        return this;
    }

    public assertIsNotVerified(unverifiedReason: string): this {
        this.validateIsSet('assertIsNotVerified');
        this._internal.assertIsNotVerified(this, unverifiedReason);
        return this;
    }

    public toString(): string {
        return this.name;
    }

    private validateIsSet(operationName: string): void {
        this.validateInExpectedState(true, operationName);
    }

    private validateIsUnset(operationName: string): void {
        this.validateInExpectedState(false, operationName);
    }

    private validateInExpectedState(needsToBeSet: boolean, operationName: string): void {
        if (this.isBreakpointSet !== needsToBeSet) {
            throw new Error(`Can't perform operation ${operationName} because it needs breakpoint to ${needsToBeSet ? '' : 'NOT '} be set`);
        }
    }
}

export type VSCodeActionWhenHit = RemoveProperty<DebugProtocol.SourceBreakpoint, 'line' | 'column'>;
