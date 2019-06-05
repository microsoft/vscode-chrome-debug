import { ExtendedDebugClient } from 'vscode-chrome-debug-core-testsupport';
import { TestProjectSpec } from '../../framework/frameworkTestSupport';
import { InternalFileBreakpointsWizard, BreakpointStatusChangedWithId } from './implementation/internalFileBreakpointsWizard';
import { DebugProtocol } from 'vscode-debugprotocol';
import { ValidatedMap } from '../../core-v2/chrome/collections/validatedMap';
import { wrapWithMethodLogger } from '../../core-v2/chrome/logging/methodsCalledLogger';
import { FileBreakpointsWizard } from './fileBreakpointsWizard';
import { BreakpointWizard } from './breakpointWizard';
import { expect } from 'chai';
import { PausedWizard } from '../pausedWizard';

export class BreakpointsWizard {
    private readonly _pausedWizard = PausedWizard.forClient(this._client);
    private readonly _pathToFileWizard = new ValidatedMap<string, InternalFileBreakpointsWizard>();

    private constructor(private readonly _client: ExtendedDebugClient, private readonly _project: TestProjectSpec) {
        this._client.on('breakpoint', breakpointStatusChange => this.onBreakpointStatusChange(breakpointStatusChange.body));
    }

    public get project() {
        return this._project;
    }

    public static create(debugClient: ExtendedDebugClient, testProjectSpecification: TestProjectSpec): BreakpointsWizard {
        return wrapWithMethodLogger(new this(debugClient, testProjectSpecification));
    }

    public at(filePath: string): FileBreakpointsWizard {
        return wrapWithMethodLogger(new FileBreakpointsWizard(this._pathToFileWizard.getOrAdd(filePath,
            () => new InternalFileBreakpointsWizard(wrapWithMethodLogger(this), this._client, this._project.src(filePath)))));
    }

    public async waitAndConsumePausedEvent(_breakpoint: BreakpointWizard): Promise<void> {
        // TODO: Should we validate the stack trace is on breakpoint here?
        await this._pausedWizard.waitAndConsumePausedEvent(pausedInfo => {
            expect(pausedInfo.reason).to.equal('breakpoint');
        });
    }

    /**
     * Instruct the debuggee to resume, and verify that the Debug-Adapter sends the proper notification after that happens
     */
    public async resume(): Promise<void> {
        return this._pausedWizard.resume();
    }

    public async waitAndConsumeResumedEvent(): Promise<void> {
        return this._pausedWizard.waitAndConsumeResumedEvent();
    }

    public async waitAndAssertNoMoreEvents(): Promise<void> {
        return this._pausedWizard.waitAndAssertNoMoreEvents();
    }

    public toString(): string {
        return 'Breakpoints';
    }

    private onBreakpointStatusChange(breakpointStatusChanged: DebugProtocol.BreakpointEvent['body']): void {
        if (this.isBreakpointStatusChangedWithId(breakpointStatusChanged)) {

            // TODO: Update this code to only send the breakpoint to the file that owns it
            for (const fileWizard of this._pathToFileWizard.values()) {
                fileWizard.onBreakpointStatusChange(breakpointStatusChanged);
            }
        }
    }

    private isBreakpointStatusChangedWithId(statusChanged: DebugProtocol.BreakpointEvent['body']): statusChanged is BreakpointStatusChangedWithId {
        return statusChanged.breakpoint.id !== undefined;
    }
}
