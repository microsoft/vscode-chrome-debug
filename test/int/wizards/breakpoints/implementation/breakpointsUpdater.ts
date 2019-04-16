import * as _ from 'lodash';
import { DebugProtocol } from 'vscode-debugprotocol';
import { BreakpointsUpdate, StateChanger, InternalFileBreakpointsWizard } from './internalFileBreakpointsWizard';
import { ExtendedDebugClient } from 'vscode-chrome-debug-core-testsupport';
import { BreakpointWizard, VSCodeActionWhenHit } from '../breakpointWizard';
import { PerformChangesImmediatelyState } from './performChangesImmediatelyState';
import { ValidatedMap } from '../../../core-v2/chrome/collections/validatedMap';
import { PauseOnHitCount } from '../../../core-v2/chrome/internal/breakpoints/bpActionWhenHit';
import { BreakpointsWizard } from '../breakpointsWizard';

export class BreakpointsUpdater {
    public constructor(
        private readonly _breakpointsWizard: BreakpointsWizard,
        private readonly _internal: InternalFileBreakpointsWizard,
        private readonly _client: ExtendedDebugClient,
        private readonly _update: BreakpointsUpdate,
        private readonly _changeState: StateChanger) { }

    public async update(): Promise<void> {
        const updatedBreakpoints = this._update.toKeepAsIs.concat(this._update.toAdd);
        const vsCodeBps = updatedBreakpoints.map(bp => this.toVSCodeProtocol(bp));

        const response = await this._client.setBreakpointsRequest({ breakpoints: vsCodeBps, source: { path: this._internal.filePath } });

        if (!response.success) {
            throw new Error(`Failed to set the breakpoints for: ${this._internal.filePath}`);
        }

        const expected = vsCodeBps.length;
        const actual = response.body.breakpoints.length;
        if (actual !== expected) {
            throw new Error(`Expected to receive ${expected} breakpoints yet we got ${actual}. Received breakpoints: ${JSON.stringify(response.body.breakpoints)}`);
        }

        const breakpointToStatus = new ValidatedMap<BreakpointWizard, DebugProtocol.Breakpoint>(_.zip(updatedBreakpoints, response.body.breakpoints));
        this._changeState(new PerformChangesImmediatelyState(this._breakpointsWizard, this._internal, breakpointToStatus));
    }

    private toVSCodeProtocol(breakpoint: BreakpointWizard): DebugProtocol.SourceBreakpoint {
        // VS Code protocol is 1-based so we add one to the line and colum numbers
        const commonInformation = { line: breakpoint.position.lineNumber + 1, column: breakpoint.position.columnNumber + 1 };
        const actionWhenHitInformation = this.actionWhenHitToVSCodeProtocol(breakpoint);
        return Object.assign({}, commonInformation, actionWhenHitInformation);
    }

    private actionWhenHitToVSCodeProtocol(breakpoint: BreakpointWizard): VSCodeActionWhenHit {
        if (breakpoint.actionWhenHit instanceof PauseOnHitCount) {
            return { hitCondition: breakpoint.actionWhenHit.pauseOnHitCondition };
        } else {
            throw new Error('Not yet implemented');
        }
    }
}