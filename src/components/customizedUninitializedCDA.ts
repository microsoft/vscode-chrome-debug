import { BaseCDAState, injectable, IInitializeRequestArgs, UninitializedCDA, ITelemetryPropertyCollector, IDebugAdapterState } from 'vscode-chrome-debug-core';
import { DebugProtocol } from 'vscode-debugprotocol';

/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

/**
 * We use our own version of the UninitializedCDA component to declare some extra capabilities that this client supports
 */
@injectable()
export class CustomizedUninitializedCDA extends BaseCDAState {
    constructor(
        private readonly _wrappedUninitializedCDA: UninitializedCDA) {
        super([], { 'initialize': (args, telemetryPropertyCollector) => this.initialize(args, telemetryPropertyCollector) });
    }

    public async install(): Promise<this> {
        await super.install();
        await this._wrappedUninitializedCDA.install();
        return this;
    }

    private async initialize(args: IInitializeRequestArgs, telemetryPropertyCollector?: ITelemetryPropertyCollector): Promise<{ capabilities: DebugProtocol.Capabilities, newState: IDebugAdapterState }> {
        const coreResponse = await this._wrappedUninitializedCDA.initialize(args, telemetryPropertyCollector);
        const coreCapabilities = coreResponse.capabilities;
        coreCapabilities.supportsRestartRequest = true;
        coreCapabilities.supportsSetExpression = true;
        coreCapabilities.supportsLogPoints = true;
        return coreResponse;
    }
}
