/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import * as utils from '../utils';
import {
    CDTP, ISupportedDomains, inject, TYPES, CDTPEventsEmitterDiagnosticsModule, IServiceComponent, ConnectedCDAConfiguration,
    CDTPDomainsEnabler, IPausedOverlayConfigurer, ICDTPDebuggeeExecutionEventsProvider, injectable
} from 'vscode-chrome-debug-core';
import { ILaunchRequestArgs } from '../chromeDebugInterfaces';

// TODO: This is a deprecated page method. We should migrate this to Overlay.setPausedInDebuggerMessage
@injectable()
export class CDTPDeprecatedPage extends CDTPEventsEmitterDiagnosticsModule<CDTP.PageApi> {
    protected readonly api = this._protocolApi.Page;

    public configureOverlay(params: unknown): Promise<void> {
        return (<any>this.api).configureOverlay(params);
    }

    constructor(
        @inject(TYPES.CDTPClient) protected readonly _protocolApi: CDTP.ProtocolApi,
        @inject(TYPES.IDomainsEnabler) _domainsEnabler: CDTPDomainsEnabler) {
        super(_domainsEnabler);
    }
}

/**
 * Show a paused overlay on the web-page so the user knows what is happening, and can resume the debugger if it gets stuck for any unexpected reason
 */
@injectable()
export class ShowOverlayWhenPaused implements IServiceComponent {
    private _pagePauseMessage = 'Paused in Visual Studio Code';
    private _overlayHelper = new utils.DebounceHelper(/*timeoutMs=*/200);
    private _removeMessageOnResume = false;

    protected async onPaused(): Promise<void> {
        this._overlayHelper.doAndCancel(async () => {
            try {
                this._supportedDomains.isSupported('Overlay') ?
                    await this._pausedOverlay.setPausedInDebuggerMessage({ message: this._pagePauseMessage }) :
                    await this._deprecatedPage.configureOverlay({ message: this._pagePauseMessage });
                this._removeMessageOnResume = true;
            } catch {
                // Ignore any errors caused by this feature given that it's not critical
                // TODO: Add telemetry
            }
        });
    }

    protected onResumed(): void {
        this._overlayHelper.wait(async () => {
            if (this._removeMessageOnResume) {
                this._removeMessageOnResume = false;
                try {
                    this._supportedDomains.isSupported('Overlay') ?
                        await this._pausedOverlay.setPausedInDebuggerMessage({}) :
                        await this._deprecatedPage.configureOverlay({});
                } catch {
                    // Ignore any errors caused by this feature given that it's not critical
                    // TODO: Add telemetry
                }
            }
        });
    }

    constructor(
        @inject(TYPES.IPausedOverlayConfigurer) private readonly _pausedOverlay: IPausedOverlayConfigurer,
        @inject(CDTPDeprecatedPage) private readonly _deprecatedPage: CDTPDeprecatedPage,
        @inject(TYPES.ICDTPDebuggeeExecutionEventsProvider) debuggeeExecutionEventsProvider: ICDTPDebuggeeExecutionEventsProvider,
        @inject(TYPES.ISupportedDomains) private readonly _supportedDomains: ISupportedDomains,
        @inject(TYPES.ConnectedCDAConfiguration) _configuration: ConnectedCDAConfiguration,
    ) {
        debuggeeExecutionEventsProvider.onPaused(() => this.onPaused());
        debuggeeExecutionEventsProvider.onResumed(() => this.onResumed());
        const clientOverlayPausedMessage = (<ILaunchRequestArgs>_configuration.args)._clientOverlayPausedMessage;
        if (clientOverlayPausedMessage) {
            this._pagePauseMessage = clientOverlayPausedMessage;
        }
    }

    public install(): this {
        return this;
    }

    public toString(): string {
        return 'ShowOverlayWhenPaused';
    }
}
