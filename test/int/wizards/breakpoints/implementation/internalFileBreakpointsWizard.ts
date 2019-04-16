import * as _ from 'lodash';
import { ExtendedDebugClient } from 'vscode-chrome-debug-core-testsupport';
import { findPositionOfTextInFile } from '../../../utils/findPositionOfTextInFile';
import { DebugProtocol } from 'vscode-debugprotocol';
import { PauseOnHitCount } from '../../../core-v2/chrome/internal/breakpoints/bpActionWhenHit';
import { BreakpointWizard } from '../breakpointWizard';
import { ValidatedMap } from '../../../core-v2/chrome/collections/validatedMap';
import { FileBreakpointsWizard } from '../fileBreakpointsWizard';
import { PromiseOrNot } from 'vscode-chrome-debug-core';
import { BatchingUpdatesState } from './batchingUpdatesState';
import { PerformChangesImmediatelyState } from './performChangesImmediatelyState';
import { BreakpointsUpdater } from './breakpointsUpdater';
import { BreakpointsWizard } from '../breakpointsWizard';

export class BreakpointsUpdate {
    public constructor(
        public readonly toAdd: BreakpointWizard[],
        public readonly toRemove: BreakpointWizard[],
        public readonly toKeepAsIs: BreakpointWizard[]) { }
}

export interface IPerformChangesImmediatelyOrBatchState {
    readonly currentBreakpointsMapping: CurrentBreakpointsMapping;

    set(breakpointWizard: BreakpointWizard): void;
    unset(breakpointWizard: BreakpointWizard): void;

    waitUntilVerified(breakpoint: BreakpointWizard): Promise<void>;
    assertIsVerified(breakpoint: BreakpointWizard): void;
    assertIsHitThenResumeWhen(breakpoint: BreakpointWizard, lastActionToMakeBreakpointHit: () => Promise<void>, expectedStackTrace: string): Promise<void>;

    onBreakpointStatusChange(breakpointStatusChanged: DebugProtocol.BreakpointEvent): void;
}

export type CurrentBreakpointsMapping = ValidatedMap<BreakpointWizard, DebugProtocol.Breakpoint>;

export type StateChanger = (newState: IPerformChangesImmediatelyOrBatchState) => void;

export class InternalFileBreakpointsWizard {
    private _state: IPerformChangesImmediatelyOrBatchState = new PerformChangesImmediatelyState(this._breakpointsWizard, this, new ValidatedMap());

    public constructor(private readonly _breakpointsWizard: BreakpointsWizard, public readonly client: ExtendedDebugClient, public readonly filePath: string) { }

    public async hitCountBreakpoint(options: { lineText: string; hitCountCondition: string; name: string }): Promise<BreakpointWizard> {
        const position = await findPositionOfTextInFile(this.filePath, options.lineText);
        return new BreakpointWizard(this, position, new PauseOnHitCount(options.hitCountCondition), options.name);
    }

    public async set(breakpointWizard: BreakpointWizard): Promise<void> {
        await this._state.set(breakpointWizard);
    }

    public async unset(breakpointWizard: BreakpointWizard): Promise<void> {
        await this._state.unset(breakpointWizard);
    }

    public async waitUntilVerified(breakpoint: BreakpointWizard): Promise<void> {
        await this._state.waitUntilVerified(breakpoint);
    }

    public assertIsVerified(breakpoint: BreakpointWizard): void {
        this._state.assertIsVerified(breakpoint);
    }

    public async assertIsHitThenResumeWhen(breakpoint: BreakpointWizard, lastActionToMakeBreakpointHit: () => Promise<void>, expectedStackTrace: string): Promise<void> {
        return this._state.assertIsHitThenResumeWhen(breakpoint, lastActionToMakeBreakpointHit, expectedStackTrace);
    }

    public onBreakpointStatusChange(breakpointStatusChanged: DebugProtocol.BreakpointEvent): void {
        this._state.onBreakpointStatusChange(breakpointStatusChanged);
    }

    public async batch<T>(batchAction: (fileBreakpointsWizard: FileBreakpointsWizard) => PromiseOrNot<T>): Promise<T> {
        const batchingUpdates = new BatchingUpdatesState(this, this._state.currentBreakpointsMapping);
        this._state = batchingUpdates;
        const result = await batchAction(new FileBreakpointsWizard(this));
        await batchingUpdates.processBatch(); // processBatch calls sendBreakpointsToClient which will change the state back to PerformChangesImmediatelyState
        return result;
    }

    public async sendBreakpointsToClient(update: BreakpointsUpdate): Promise<void> {
        return new BreakpointsUpdater(this._breakpointsWizard, this, this.client, update, state => this._state = state).update();
    }
}
