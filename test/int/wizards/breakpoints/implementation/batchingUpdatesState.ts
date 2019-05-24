/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import _ = require('lodash');
import { BreakpointWizard } from '../breakpointWizard';
import { PromiseOrNot } from 'vscode-chrome-debug-core';
import { ValidatedSet } from '../../../core-v2/chrome/collections/validatedSet';
import {
    IBreakpointsBatchingStrategy, InternalFileBreakpointsWizard, CurrentBreakpointsMapping, BreakpointsUpdate, BreakpointStatusChangedWithId
} from './internalFileBreakpointsWizard';
import { IVerifications } from './breakpointsAssertions';

export class BatchingUpdatesState implements IBreakpointsBatchingStrategy {
    private readonly _breakpointsToSet = new ValidatedSet<BreakpointWizard>();
    private readonly _breakpointsToUnset = new ValidatedSet<BreakpointWizard>();
    private readonly _actionsToCompleteAfterBatch: (() => PromiseOrNot<void>)[] = [];

    public constructor(private readonly _internal: InternalFileBreakpointsWizard, public readonly currentBreakpointsMapping: CurrentBreakpointsMapping) {}

    public set(breakpointWizard: BreakpointWizard): void {
        this._breakpointsToSet.add(breakpointWizard);
        this._breakpointsToUnset.deleteIfExists(breakpointWizard);
    }

    public unset(breakpointWizard: BreakpointWizard) {
        this._breakpointsToUnset.add(breakpointWizard);
        this._breakpointsToSet.deleteIfExists(breakpointWizard);
    }

    public assertIsVerified(breakpoint: BreakpointWizard): void {
        this._actionsToCompleteAfterBatch.push(() => this._internal.assertIsVerified(breakpoint));
    }

    public async waitUntilVerified(breakpoint: BreakpointWizard): Promise<void> {
        this._actionsToCompleteAfterBatch.push(() => this._internal.waitUntilVerified(breakpoint));
    }

    public onBreakpointStatusChange(_breakpointStatusChanged: BreakpointStatusChangedWithId): void {
        throw new Error(`Breakpoint status shouldn't be updated while doing a batch update. Is this happening due to a product or test bug?`);
    }

    public async assertIsHitThenResumeWhen(_breakpoint: BreakpointWizard, _lastActionToMakeBreakpointHit: () => Promise<void>, _verifications: IVerifications): Promise<void> {
        throw new Error(`Breakpoint shouldn't be verified while doing a batch update. Is this happening due to a product or test bug?`);
    }

    public async assertIsHitThenResume(_breakpoint: BreakpointWizard, _verifications: IVerifications): Promise<void> {
        throw new Error(`Breakpoint shouldn't be verified while doing a batch update. Is this happening due to a product or test bug?`);
    }

    public async processBatch(): Promise<void> {
        const breakpointsToKeepAsIs = _.difference(Array.from(this.currentBreakpointsMapping.keys()), this._breakpointsToSet.toArray(), this._breakpointsToUnset.toArray());

        await this._internal.sendBreakpointsToClient(new BreakpointsUpdate(Array.from(this._breakpointsToSet), Array.from(this._breakpointsToUnset), breakpointsToKeepAsIs));

        // this._internal.sendBreakpointsToClient changed the state to PerformChangesImmediatelyState so we can now execute the actions we had pending
        await this.executeActionsToCompleteAfterBatch();
    }

    private async executeActionsToCompleteAfterBatch(): Promise<void> {
        // Validate with the originalSize that the actionsToCompleteAfterBatch aren't re-scheduled in a recursive way forever...
        const originalSize = this._actionsToCompleteAfterBatch.length;

        for (const actionToComplete of this._actionsToCompleteAfterBatch) {
            await actionToComplete();
        }

        if (this._actionsToCompleteAfterBatch.length > originalSize) {
            throw new Error(`The list of actions to complete increased while performing the actions to complete.`
                + ` The actions to complete probably ended up recursively scheduling more actions which is a bug`);
        }
    }
}
