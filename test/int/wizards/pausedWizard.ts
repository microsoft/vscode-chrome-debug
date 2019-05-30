/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DebugProtocol } from 'vscode-debugprotocol';
import { ExtendedDebugClient } from 'vscode-chrome-debug-core-testsupport';
import { logger } from 'vscode-debugadapter';
import { utils } from 'vscode-chrome-debug-core';
import { isThisV2 } from '../testSetup';
import { waitUntilReadyWithTimeout } from '../utils/waitUntilReadyWithTimeout';
import { StoppedEvent, ContinuedEvent } from 'vscode-debugadapter';
import { expect } from 'chai';
import { ValidatedMap } from '../core-v2/chrome/collections/validatedMap';
import { wrapWithMethodLogger } from '../core-v2/chrome/logging/methodsCalledLogger';

/** Helper methods to wait and/or verify when the debuggee was paused for any kind of pause.
 *
 * Warning: Needs to be created before the debuggee is launched to capture all events and avoid race conditions
 */
export class PausedWizard {
    private _noMoreEventsExpected = false;
    private _eventsToBeConsumed: (DebugProtocol.ContinuedEvent | DebugProtocol.StoppedEvent)[] = [];
    private static _clientToPausedWizard = new ValidatedMap<ExtendedDebugClient, PausedWizard>();

    private constructor(private readonly _client: ExtendedDebugClient) {
        this._client.on('stopped', stopped => {
            this.validateNoMoreEventsIfSet(stopped);
            this._eventsToBeConsumed.push(stopped);
            this.logState();
        });
        this._client.on('continued', continued => {
            this.validateNoMoreEventsIfSet(continued);
            this._eventsToBeConsumed.push(continued);
            this.logState();
        });
    }

    // The PausedWizard logic will break if we create 2 PausedWizards for the same client. So we warranty we only create one
    public static forClient(client: ExtendedDebugClient): PausedWizard {
        return this._clientToPausedWizard.getOrAdd(client, () => wrapWithMethodLogger(new PausedWizard(client)));
    }

    /**
     * Wait for a little while, and verify that the debuggee is not paused after that
     *
     * @param millisecondsToWaitForPauses How much time to wait for pauses
     */
    public async waitAndAssertNotPaused(millisecondsToWaitForPauses = 1000 /*ms*/): Promise<void> {
        await utils.promiseTimeout(undefined, millisecondsToWaitForPauses); // Wait for 1 second (to anything on flight has time to finish) and verify that we are not paused afterwards
        await this.state.assertNotPaused();
    }

    /** Return whether the debuggee is currently paused */
    public isPaused(): boolean {
        return this.state.isPaused();
    }

    /** Wait and block until the debuggee is paused on a debugger statement */
    public async waitUntilPausedOnDebuggerStatement(): Promise<void> {
        return this.waitUntilPaused(pauseInfo => {
            expect(pauseInfo.description).to.equal('Paused on debugger statement');
            expect(pauseInfo.reason).to.equal('debugger_statement');
        });
    }

    /** Wait and block until the debuggee is paused, and then perform the specified action with the pause event's body */
    public async waitUntilPaused(actionWithPausedInfo: (pausedInfo: DebugProtocol.StoppedEvent['body']) => void): Promise<void> {
        await waitUntilReadyWithTimeout(() => this.state instanceof PausedEventAvailableToBeConsumed);

        actionWithPausedInfo(this.state.assertIsPaused().body);
    }

    /** Wait and block until the debuggee has been resumed */
    public async waitUntilJustResumed(): Promise<void> {
        // We assume that nobody is consuming events in parallel, so if we start paused, the wait call won't ever succeed
        expect(this.state).to.not.be.instanceOf(PausedEventAvailableToBeConsumed);

        await waitUntilReadyWithTimeout(() => this.state instanceof ResumedEventAvailableToBeConsumed);

        await this.state.assertNotPaused();
    }

    /**
     * Instruct the debuggee to resume, and verify that the Debug-Adapter sends the proper notification after that happens
     */
    public async resume(): Promise<void> {
        await this._client.continueRequest();
        if (isThisV2) {
            // TODO: Is getting this event on V2 a bug? See: Continued Event at https://microsoft.github.io/debug-adapter-protocol/specification
            await this.waitUntilJustResumed();
        }
    }

    public assertNoMoreEvents(): void {
        expect(this.state).to.be.instanceOf(NoEventAvailableToBeConsumed);
        this._noMoreEventsExpected = true;
    }

    private validateNoMoreEventsIfSet(event: DebugProtocol.ContinuedEvent | DebugProtocol.StoppedEvent): void {
        if (this._noMoreEventsExpected) {
            throw new Error(`Received an event after it was signaled that no more events were expected: ${JSON.stringify(event)}`);
        }
    }

    private logState() {
        logger.log(`Resume/Pause #events = ${this._eventsToBeConsumed.length}, state = ${this.state}`);
    }

    private get state(): IEventForConsumptionAvailabilityState {
        if (this._eventsToBeConsumed.length === 0) {
            return new NoEventAvailableToBeConsumed();
        } else {
            const nextEventToBeConsumed = this._eventsToBeConsumed[0];
            switch (nextEventToBeConsumed.event) {
                case 'stopped':
                    return new PausedEventAvailableToBeConsumed(() => this.markNextEventAsConsumed('stopped'), <StoppedEvent>nextEventToBeConsumed);
                case 'continued':
                    return new ResumedEventAvailableToBeConsumed(() => this.markNextEventAsConsumed('continued'), <ContinuedEvent>nextEventToBeConsumed);
                default:
                    throw new Error(`Expected the event to be consumed to be either a stopped or continued yet it was: ${JSON.stringify(nextEventToBeConsumed)}`);
            }
        }
    }

    private markNextEventAsConsumed(eventName: 'continued' | 'stopped'): void {
        expect(this._eventsToBeConsumed).length.to.be.greaterThan(0);
        expect(this._eventsToBeConsumed[0].event).to.equal(eventName);
        this._eventsToBeConsumed.shift();
        this.logState();
    }

    public toString(): string {
        return 'PausedWizard';
    }
}


interface IEventForConsumptionAvailabilityState {
    readonly latestEvent: DebugProtocol.StoppedEvent | DebugProtocol.ContinuedEvent;

    assertIsPaused(): DebugProtocol.StoppedEvent;
    assertNotPaused(): void;

    isPaused(): boolean;
}

type MarkNextEventWasConsumed = () => void;

class PausedEventAvailableToBeConsumed implements IEventForConsumptionAvailabilityState {
    public constructor(protected readonly _markNextEventWasConsumed: MarkNextEventWasConsumed, public readonly latestEvent: DebugProtocol.StoppedEvent) { }

    public isPaused(): boolean {
        return true;
    }

    public assertIsPaused(): DebugProtocol.StoppedEvent {
        this._markNextEventWasConsumed();
        return this.latestEvent;
    }

    public assertNotPaused(): void {
        expect(this.latestEvent.event, `Expected that there was not new paused event to be consumed, and that the debugger wasn't paused yet the state was: ${this}`)
            .to.not.equal('stopped');
    }

    public toString(): string {
        return `Event available to be consumed: ${JSON.stringify(this.latestEvent)}`;
    }
}

class ResumedEventAvailableToBeConsumed implements IEventForConsumptionAvailabilityState {
    public constructor(protected readonly _markNextEventWasConsumed: MarkNextEventWasConsumed, public readonly latestEvent: DebugProtocol.ContinuedEvent) { }

    public assertIsPaused(): DebugProtocol.StoppedEvent {
        throw new Error(`The debugger is not paused`);
    }

    public assertNotPaused(): void {
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

    public assertIsPaused(): never {
        throw new Error(`There is no event available to be consumed`);
    }

    public assertNotPaused(): void {
        // Always true for this state
    }

    public isPaused(): boolean {
        return false;
    }

    public toString(): string {
        return `NoEventAvailableToBeConsumed`;
    }
}
