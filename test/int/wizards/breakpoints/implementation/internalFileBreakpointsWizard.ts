/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtendedDebugClient } from 'vscode-chrome-debug-core-testsupport';
import { findPositionOfTextInFile } from '../../../utils/findPositionOfTextInFile';
import { DebugProtocol } from 'vscode-debugprotocol';
import { AlwaysPause, IBPActionWhenHit } from '../../../core-v2/chrome/internal/breakpoints/bpActionWhenHit';
import { BreakpointWizard } from '../breakpointWizard';
import { ValidatedMap } from '../../../core-v2/chrome/collections/validatedMap';
import { FileBreakpointsWizard } from '../fileBreakpointsWizard';
import { PromiseOrNot } from 'vscode-chrome-debug-core';
import { BatchingUpdatesState } from './batchingUpdatesState';
import { PerformChangesImmediatelyState } from './performChangesImmediatelyState';
import { BreakpointsUpdater } from './breakpointsUpdater';
import { BreakpointsWizard } from '../breakpointsWizard';
import { MakePropertyRequired, Replace } from '../../../core-v2/typeUtils';
import { IVerifications } from './breakpointsAssertions';

export type BreakpointWithId = MakePropertyRequired<DebugProtocol.Breakpoint, 'id'>;
export type BreakpointStatusChangedWithId = Replace<DebugProtocol.BreakpointEvent['body'], 'breakpoint', BreakpointWithId>;

export class BreakpointsUpdate {
    public constructor(
        public readonly toAdd: BreakpointWizard[],
        public readonly toRemove: BreakpointWizard[],
        public readonly toKeepAsIs: BreakpointWizard[]) { }
}

export interface IBreakpointsBatchingStrategy {
    readonly currentBreakpointsMapping: CurrentBreakpointsMapping;

    set(breakpointWizard: BreakpointWizard): void;
    unset(breakpointWizard: BreakpointWizard): void;

    waitUntilVerified(breakpoint: BreakpointWizard): Promise<void>;
    assertIsVerified(breakpoint: BreakpointWizard): void;
    assertIsHitThenResumeWhen(breakpoint: BreakpointWizard, lastActionToMakeBreakpointHit: () => Promise<void>, verifications: IVerifications): Promise<void>;
    assertIsHitThenResume(breakpoint: BreakpointWizard, verifications: IVerifications): Promise<void>;

    onBreakpointStatusChange(breakpointStatusChanged: BreakpointStatusChangedWithId): void;
}

export type CurrentBreakpointsMapping = ValidatedMap<BreakpointWizard, BreakpointWithId>;

export type StateChanger = (newState: IBreakpointsBatchingStrategy) => void;

export class InternalFileBreakpointsWizard {
    private readonly _breakpointsUpdater = new BreakpointsUpdater(this._breakpointsWizard, this, this.client, state => this._state = state);

    private _state: IBreakpointsBatchingStrategy = new PerformChangesImmediatelyState(this._breakpointsWizard, this, new ValidatedMap());

    public constructor(private readonly _breakpointsWizard: BreakpointsWizard, public readonly client: ExtendedDebugClient, public readonly filePath: string) { }

    public async breakpoint(options: { name: string, text: string, boundText?: string, actionWhenHit?: IBPActionWhenHit}) {
        const position = await findPositionOfTextInFile(this.filePath, options.text);
        const boundPosition = options.boundText ? await findPositionOfTextInFile(this.filePath, options.boundText) : position;
        const actionWhenHit = options.actionWhenHit || new AlwaysPause();

        return new BreakpointWizard(this, position, actionWhenHit, options.name, boundPosition);
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

    public async assertIsHitThenResumeWhen(breakpoint: BreakpointWizard, lastActionToMakeBreakpointHit: () => Promise<void>, verifications: IVerifications): Promise<void> {
        return this._state.assertIsHitThenResumeWhen(breakpoint, lastActionToMakeBreakpointHit, verifications);
    }

    public async assertIsHitThenResume(breakpoint: BreakpointWizard, verifications: IVerifications): Promise<void> {
        return this._state.assertIsHitThenResume(breakpoint, verifications);
    }

    public onBreakpointStatusChange(breakpointStatusChanged: BreakpointStatusChangedWithId): void {
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
        return this._breakpointsUpdater.update(update);
    }
}
