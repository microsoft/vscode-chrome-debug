import { ExtendedDebugClient } from 'vscode-chrome-debug-core-testsupport';
import { TestProjectSpec } from '../../framework/frameworkTestSupport';
import { InternalFileBreakpointsWizard, BreakpointStatusChangedWithId } from './implementation/internalFileBreakpointsWizard';
import { DebugProtocol } from 'vscode-debugprotocol';
import { ValidatedMap } from '../../core-v2/chrome/collections/validatedMap';
import { wrapWithMethodLogger } from '../../core-v2/chrome/logging/methodsCalledLogger';
import { FileBreakpointsWizard } from './fileBreakpointsWizard';
import { waitUntilReadyWithTimeout } from '../../utils/waitUntilReadyWithTimeout';
import { expect } from 'chai';
import { BreakpointWizard } from './breakpointWizard';
import { logger, ContinuedEvent, StoppedEvent } from 'vscode-debugadapter';
import { isThisV2 } from '../../testSetup';

export class BreakpointsWizard {
    private _eventsToBeConsumed: (DebugProtocol.ContinuedEvent | DebugProtocol.StoppedEvent)[] = [];
    private readonly _pathToFileWizard = new ValidatedMap<string, InternalFileBreakpointsWizard>();

    private constructor(private readonly _client: ExtendedDebugClient, private readonly _project: TestProjectSpec) {
        this._client.on('stopped', stopped => {
            this._eventsToBeConsumed.push(stopped);
            this.logState();
        });
        this._client.on('continued', continued => {
            this._eventsToBeConsumed.push(continued);
            this.logState();
        });
        this._client.on('breakpoint', breakpointStatusChange => this.onBreakpointStatusChange(breakpointStatusChange.body));
    }

    private logState() {
        logger.log(`BreakpointsWizard #events = ${this._eventsToBeConsumed.length}, state = ${this.state}`);
    }

    public static create(debugClient: ExtendedDebugClient, testProjectSpecification: TestProjectSpec): BreakpointsWizard {
        return wrapWithMethodLogger(new this(debugClient, testProjectSpecification));
    }

    public at(filePath: string): FileBreakpointsWizard {
        return wrapWithMethodLogger(new FileBreakpointsWizard(this._pathToFileWizard.getOrAdd(filePath,
            () => new InternalFileBreakpointsWizard(wrapWithMethodLogger(this), this._client, this._project.src(filePath)))));
    }

    public async assertNotPaused(): Promise<void> {
        await this.state.assertNotPaused();
    }

    public assertIsPaused(breakpoint: BreakpointWizard): void {
        this.state.assertIsPaused(breakpoint);
    }

    public isPaused(): boolean {
        return this.state.isPaused();
    }


    public async waitUntilJustResumed(): Promise<void> {
        await waitUntilReadyWithTimeout(() => this.state instanceof ResumedEventAvailableToBeConsumed);

        await this.state.assertNotPaused();
    }

    public async resume(): Promise<void> {
        await this._client.continueRequest();
        if (isThisV2) {
            // TODO: Is getting this event on V2 a bug? See: Continued Event at https://microsoft.github.io/debug-adapter-protocol/specification
            await this.waitUntilJustResumed();
        }
    }

    public async waitUntilPaused(breakpoint: BreakpointWizard): Promise<void> {
        await waitUntilReadyWithTimeout(() => this.state instanceof PausedEventAvailableToBeConsumed);

        await this.state.assertIsPaused(breakpoint);
    }

    public toString(): string {
        return 'Breakpoints';
    }

    private get state(): IEventForConsumptionAvailabilityState {
        if (this._eventsToBeConsumed.length === 0) {
            return new NoEventAvailableToBeConsumed();
        } else {
            const nextEventToBeConsumed = this._eventsToBeConsumed[0];
            switch (nextEventToBeConsumed.event) {
                case 'stopped':
                    return new PausedEventAvailableToBeConsumed(this.markNextEventAsConsumed(), <StoppedEvent>nextEventToBeConsumed);
                case 'continued':
                    return new ResumedEventAvailableToBeConsumed(this.markNextEventAsConsumed(), <ContinuedEvent>nextEventToBeConsumed);
                default:
                    throw new Error(`Expected the event to be consumed to be either a stopped or continued yet it was: ${JSON.stringify(nextEventToBeConsumed)}`);
            }
        }
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

    private markNextEventAsConsumed(): () => void {
        return () => {
            this._eventsToBeConsumed.shift();
            this.logState();
        };
    }
}

interface IEventForConsumptionAvailabilityState {
    readonly latestEvent: DebugProtocol.StoppedEvent | DebugProtocol.ContinuedEvent;

    assertIsPaused(breakpoint: BreakpointWizard): void;
    assertNotPaused(): Promise<void>;

    isPaused(): boolean;
}

type MarkNextEventWasConsumed = () => void;

class PausedEventAvailableToBeConsumed implements IEventForConsumptionAvailabilityState {
    public constructor(protected readonly _markNextEventWasConsumed: MarkNextEventWasConsumed, public readonly latestEvent: DebugProtocol.StoppedEvent) { }

    public assertIsPaused(_breakpoint: BreakpointWizard): void {
        expect(this.latestEvent.body.reason).to.equal('breakpoint');
        this._markNextEventWasConsumed();
    }

    public isPaused(): boolean {
        return true;
    }

    public async assertNotPaused(): Promise<void> {
        expect(this.latestEvent.event, `Expected that there was not new paused event to be consumed, and that the debugger wasn't paused yet the state was: ${this}`)
            .to.not.equal('stopped');
    }

    public toString(): string {
        return `Event available to be consumed: ${JSON.stringify(this.latestEvent)}`;
    }
}

class ResumedEventAvailableToBeConsumed implements IEventForConsumptionAvailabilityState {
    public constructor(protected readonly _markNextEventWasConsumed: MarkNextEventWasConsumed, public readonly latestEvent: DebugProtocol.ContinuedEvent) { }

    public assertIsPaused(_breakpoint: BreakpointWizard): void {
        throw new Error(`The debugger is not paused`);
    }

    public async assertNotPaused(): Promise<void> {
        this._markNextEventWasConsumed();
    }

    public isPaused(): boolean {
        return false;
    }

    public toString(): string {
        return `Resumed Event available to be consumed: ${JSON.stringify(this.latestEvent)}`;
    }
}

class NoEventAvailableToBeConsumed implements IEventForConsumptionAvailabilityState {
    public get latestEvent(): never {
        throw new Error(`There is no event available to be consumed`);
    }

    public assertIsPaused(_breakpoint: BreakpointWizard): void {
        throw new Error(`There is no event available to be consumed`);
    }

    public async assertNotPaused(): Promise<void> {
        // Always true for this state
    }

    public isPaused(): boolean {
        return false;
    }

    public toString(): string {
        return `NoEventAvailableToBeConsumed`;
    }
}
