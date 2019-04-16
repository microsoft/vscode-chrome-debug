import { Position } from '../../core-v2/chrome/internal/locations/location';
import { IBPActionWhenHit } from '../../core-v2/chrome/internal/breakpoints/bpActionWhenHit';
import { InternalFileBreakpointsWizard } from './implementation/internalFileBreakpointsWizard';
import { RemoveProperty } from '../../core-v2/typeUtils';
import { DebugProtocol } from 'vscode-debugprotocol';

export class BreakpointWizard {
    private _state: IBreakpointSetOrUnsetState = new BreakpointUnsetState(this, this._internal, this.changeStateFunction());

    public constructor(
        private readonly _internal: InternalFileBreakpointsWizard, public readonly position: Position,
        public readonly actionWhenHit: IBPActionWhenHit, public readonly name: string) { }

    public async setThenWaitForVerifiedThenValidate(): Promise<BreakpointWizard> {
        await this.setWithoutVerifying();
        await this.waitUntilVerified();
        this.assertIsVerified();
        return this;
    }

    public async waitUntilVerified(): Promise<BreakpointWizard> {
        await this._state.waitUntilVerified();
        return this;
    }

    public async setWithoutVerifying(): Promise<BreakpointWizard> {
        await this._state.set();
        return this;
    }

    public async unset(): Promise<BreakpointWizard> {
        await this._state.unset();
        return this;
    }

    public async assertIsHitThenResumeWhen(lastActionToMakeBreakpointHit: () => Promise<void>, expectedStackTrace: string): Promise<BreakpointWizard> {
        await this._state.assertIsHitThenResumeWhen(lastActionToMakeBreakpointHit, expectedStackTrace);
        return this;
    }

    public assertIsVerified(): this {
        this._state.assertIsVerified();
        return this;
    }

    private changeStateFunction(): ChangeBreakpointWizardState {
        return newState => this._state = newState;
    }

    public toString(): string {
        return this.name;
    }
}

export type VSCodeActionWhenHit = RemoveProperty<DebugProtocol.SourceBreakpoint, 'line' | 'column'>;

export type ChangeBreakpointWizardState = (newState: IBreakpointSetOrUnsetState) => void;

export interface IBreakpointSetOrUnsetState {
    set(): Promise<void>;
    unset(): Promise<void>;
    assertIsHitThenResumeWhen(lastActionToMakeBreakpointHit: () => Promise<void>, expectedStackTrace: string): Promise<void>;
    assertIsVerified(): void;
    waitUntilVerified(): Promise<void>;
}

class BreakpointSetState implements IBreakpointSetOrUnsetState {
    public constructor(
        private readonly _breakpoint: BreakpointWizard,
        private readonly _internal: InternalFileBreakpointsWizard,
        private readonly _changeState: ChangeBreakpointWizardState) {
    }

    public set(): Promise<void> {
        throw new Error(`Can't set a breakpoint that is already set`);
    }

    public async unset(): Promise<void> {
        await this._internal.unset(this._breakpoint);
        this._changeState(new BreakpointUnsetState(this._breakpoint, this._internal, this._changeState));
    }

    public assertIsHitThenResumeWhen(lastActionToMakeBreakpointHit: () => Promise<void>, expectedStackTrace: string): Promise<void> {
        return this._internal.assertIsHitThenResumeWhen(this._breakpoint, lastActionToMakeBreakpointHit, expectedStackTrace);
    }

    public assertIsVerified(): void {
        this._internal.assertIsVerified(this._breakpoint);
    }

    public async waitUntilVerified(): Promise<void> {
        await this._internal.waitUntilVerified(this._breakpoint);
    }
}

export class BreakpointUnsetState implements IBreakpointSetOrUnsetState {
    public constructor(
        private readonly _breakpoint: BreakpointWizard,
        private readonly _internal: InternalFileBreakpointsWizard,
        private readonly _changeState: ChangeBreakpointWizardState) {
    }

    public async set(): Promise<void> {
        await this._internal.set(this._breakpoint);
        this._changeState(new BreakpointSetState(this._breakpoint, this._internal, this._changeState));
    }

    public unset(): Promise<void> {
        throw new Error(`Can't unset a breakpoint that is already unset`);
    }

    public assertIsHitThenResumeWhen(_lastActionToMakeBreakpointHit: () => Promise<void>, _expectedStackTrace: string): Promise<void> {
        throw new Error(`Can't expect to hit a breakpoint that is unset`);
    }

    public assertIsVerified(): never {
        throw new Error(`Can't expect an unset breakpoint to be verified`);
    }

    public async waitUntilVerified(): Promise<void> {
        throw new Error(`Can't expect an unset breakpoint to ever become verified`);
    }
}
