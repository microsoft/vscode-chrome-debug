/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import {
    IDebuggeeRunner, ITelemetryPropertyCollector, inject,
    injectable, postConstruct, TYPES, utils as coreUtils, CDTP, IBrowserNavigator, parseResourceIdentifier, logger
} from 'vscode-chrome-debug-core';
import Uri from 'vscode-uri';
import { ConnectedCDAConfiguration } from 'vscode-chrome-debug-core';

/**
 * Run the specified web-page url in Chrome
 */
@injectable()
export class ChromeRunner implements IDebuggeeRunner {
    private readonly _userPageLaunched = coreUtils.promiseDefer<void>();

    public constructor(
        @inject(TYPES.ConnectedCDAConfiguration) private readonly _configuration: ConnectedCDAConfiguration,
        @inject(TYPES.IBrowserNavigation) private readonly _browserNavigation: IBrowserNavigator) {
        this.install();
    }

    public async run(_telemetryPropertyCollector: ITelemetryPropertyCollector): Promise<void> {
        // TODO: Is this needed?  await this._browserNavigation.enable();

        if (this._configuration.userRequestedUrl) {
            // This means all the setBreakpoints requests have been completed. So we can navigate to the original file/url.
            this._browserNavigation.navigate({ url: this._configuration.userRequestedUrl }).then(() => {
                /* __GDPR__FRAGMENT__
                   "StepNames" : {
                      "RequestedNavigateToUserPage" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
                   }
                 */
            });
        }

        return this._userPageLaunched.promise;
    }

    @postConstruct()
    protected install(): void {
        this._browserNavigation.onFrameNavigated(params => this.onFrameNavigated(params));
    }

    protected onFrameNavigated(params: CDTP.Page.FrameNavigatedEvent): void {
        if (this._configuration.userRequestedUrl) {
            // TODO: Make sure we are doing the right thing in this method and we send proper telemetry
            const url = Uri.parse(params.frame.url).toString();
            const requestedUrlNoAnchor = this._configuration.userRequestedUrl.split('#')[0]; // Frame navigated url doesn't include the anchor
            const requestedIdentifier = parseResourceIdentifier(Uri.parse(requestedUrlNoAnchor).toString());
            const urlIdentifier = parseResourceIdentifier(url);
            if (url === requestedUrlNoAnchor || decodeURI(url) === requestedUrlNoAnchor
                || requestedIdentifier.isEquivalentTo(urlIdentifier)) { // 'http://localhost:1234/test%20page' will use the not decoded version, 'http://localhost:1234/test page' will use the decoded version
                // Chrome started to navigate to the user's requested url
                this._userPageLaunched.resolve();
            } else if (url === 'chrome-error://chromewebdata/') {
                // Chrome couldn't retrieve the web-page in the requested url
                this._userPageLaunched.reject(new Error(`Unreachable URL: Chrome navigated to ${url} instead of navigating to the requested url: ${this._configuration.userRequestedUrl}`));
            } else if (url.startsWith('chrome-error://')) {
                // Uknown chrome error
                this._userPageLaunched.reject(new Error(`Unknown Chrome Error: Chrome navigated to ${url} instead of navigating to the requested url: ${this._configuration.userRequestedUrl}`));
            } else {
                logger.log(`ChromeRunner.onFrameNavigated: Unexpected case: url: ${params.frame.url} requested: ${this._configuration.userRequestedUrl}`);
            }
        }
    }

    public async stop(): Promise<void> {
        // Nothing to do here. The chromeLauncher.stop() is handling everything at this time
    }
}