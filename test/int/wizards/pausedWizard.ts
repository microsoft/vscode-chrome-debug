/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DebugProtocol } from 'vscode-debugprotocol';
import { ExtendedDebugClient, THREAD_ID } from 'vscode-chrome-debug-core-testsupport';
import { logger } from 'vscode-debugadapter';
import { utils } from 'vscode-chrome-debug-core';
import { isThisV2 } from '../testSetup';
import { waitUntilReadyWithTimeout } from '../utils/waitUntilReadyWithTimeout';
import { expect } from 'chai';
import { ValidatedMap } from '../core-v2/chrome/collections/validatedMap';
import { wrapWithMethodLogger } from '../core-v2/chrome/logging/methodsCalledLogger';

enum EventToConsume {
    Paused,
    Resumed,
    None
}

/** Helper methods to wait and/or verify when the debuggee was paused for any kind of pause.
 *
 * Warning: Needs to be created before the debuggee is launched to capture all events and avoid race conditions
 */
export class PausedWizard {
    private _noMoreEventsExpected = false;
    private _eventsToBeConsumed: (DebugProtocol.ContinuedEvent | DebugProtocol.StoppedEvent)[] = [];
    private static _clientToPausedWizard = new ValidatedMap<ExtendedDebugClient, PausedWizard>();

    private constructor(private readonly _client: ExtendedDebugClient) {
        this._client.on('stopped', stopped => this.onEvent(stopped));
        if(isThisV2) { // Don't bother subscribing on v1, as v1 sends more continues than strictly necessary
            this._client.on('continued', continued => this.onEvent(continued));
        }
    }

    private onEvent(continued: any) {
        this.validateNoMoreEventsIfSet(continued);
        this._eventsToBeConsumed.push(continued);
        this.logState();
    }

    // The PausedWizard logic will break if we create 2 PausedWizards for the same client. So we warranty we only create one
    public static forClient(client: ExtendedDebugClient): PausedWizard {
        return this._clientToPausedWizard.getOrAdd(client, () => wrapWithMethodLogger(new PausedWizard(client)));
    }

    /**
     * Verify that the debuggee is not paused
     *
     * @param millisecondsToWaitForPauses How much time to wait for pauses
     */
    public async waitAndConsumeResumedEvent(): Promise<void> {
        if(isThisV2) {
            await waitUntilReadyWithTimeout(() => this.nextEventToConsume === EventToConsume.Resumed);
            this.markNextEventAsConsumed('continued');
        }
    }

    /** Return whether the debuggee is currently paused */
    public isPaused(): boolean {
        return this.nextEventToConsume === EventToConsume.Paused;
    }

    /** Wait and block until the debuggee is paused on a debugger statement */
    public async waitUntilPausedOnDebuggerStatement(): Promise<void> {
        return this.waitAndConsumePausedEvent(pauseInfo => {
            expect(pauseInfo.description).to.equal('Paused on debugger statement');
            expect(pauseInfo.reason).to.equal('debugger_statement');
        });
    }

    /** Wait and block until the debuggee is paused, and then perform the specified action with the pause event's body */
    public async waitAndConsumePausedEvent(actionWithPausedInfo: (pausedInfo: DebugProtocol.StoppedEvent['body']) => void): Promise<void> {
        await waitUntilReadyWithTimeout(() => this.nextEventToConsume === EventToConsume.Paused);
        const pausedEvent = <DebugProtocol.StoppedEvent>this._eventsToBeConsumed[0];
        this.markNextEventAsConsumed('stopped');
        actionWithPausedInfo(pausedEvent.body);
    }

    /** Wait and block until the debuggee has been resumed */
    public async waitUntilResumed(): Promise<void> {
        // We assume that nobody is consuming events in parallel, so if we start paused, the wait call won't ever succeed
        expect(this.nextEventToConsume).to.not.equal(EventToConsume.Paused);

        await waitUntilReadyWithTimeout(() => this.nextEventToConsume === EventToConsume.Resumed);

        this.markNextEventAsConsumed('continued');
    }

    /**
     * Instruct the debuggee to resume, and verify that the Debug-Adapter sends the proper notification after that happens
     */
    public async resume(): Promise<void> {
        await this._client.continueRequest();
        if (isThisV2) {
            // TODO: Is getting this event on V2 a bug? See: Continued Event at https://microsoft.github.io/debug-adapter-protocol/specification
            await this.waitUntilResumed();
        }
    }

    /**
     * Instruct the debuggee to pause, and verify that the Debug-Adapter sends the proper notification after that happens
     */
    public async pause(): Promise<void> {
        await this._client.pauseRequest({ threadId: THREAD_ID });

        await this.waitAndConsumePausedEvent(event => {
            expect(event.reason).to.equal('pause');
            expect(event.description).to.equal('Paused on user request');
        });
    }

    public async waitAndAssertNoMoreEvents(): Promise<void> {
        expect(this.nextEventToConsume).to.equal(EventToConsume.None);
        this._noMoreEventsExpected = true;

        // Wait some time, to see if any events appear eventually
        await utils.promiseTimeout(undefined, 500);

        expect(this.nextEventToConsume).to.equal(EventToConsume.None);
    }

    private validateNoMoreEventsIfSet(event: DebugProtocol.ContinuedEvent | DebugProtocol.StoppedEvent): void {
        if (this._noMoreEventsExpected) {
            if(isThisV2) {
                throw new Error(`Received an event after it was signaled that no more events were expected: ${JSON.stringify(event)}`);
            } //no-op this for V1
        }
    }

    private logState() {
        logger.log(`Resume/Pause #events = ${this._eventsToBeConsumed.length}, state = ${EventToConsume[this.nextEventToConsume]}`);
    }

    private get nextEventToConsume(): EventToConsume {
        if (this._eventsToBeConsumed.length === 0) {
            return EventToConsume.None;
        } else {
            const nextEventToBeConsumed = this._eventsToBeConsumed[0];
            switch (nextEventToBeConsumed.event) {
                case 'stopped':
                    return EventToConsume.Paused;
                case 'continued':
                    return EventToConsume.Resumed;
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
