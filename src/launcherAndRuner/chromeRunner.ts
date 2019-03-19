import {
    IDebuggeeRunner, ITelemetryPropertyCollector, inject,
    injectable, postConstruct, TYPES, utils as coreUtils, CDTP, IBrowserNavigator
} from 'vscode-chrome-debug-core';
import { ChromeLauncher } from './chromeLauncher';

/**
 * Run the specified web-page url in Chrome
 */
@injectable()
export class ChromeRunner implements IDebuggeeRunner {
    private readonly _userPageLaunched = coreUtils.promiseDefer<void>();

    public async run(_telemetryPropertyCollector: ITelemetryPropertyCollector): Promise<void> {
        // TODO: Is this needed?  await this._browserNavigation.enable();

        if (this._chromeLauncher.userRequestedUrl) {
            // This means all the setBreakpoints requests have been completed. So we can navigate to the original file/url.
            this._browserNavigation.navigate({ url: this._chromeLauncher.userRequestedUrl }).then(() => {
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
        if (this._chromeLauncher.userRequestedUrl) {
            const url = params.frame.url;
            const requestedUrlNoAnchor = this._chromeLauncher.userRequestedUrl.split('#')[0]; // Frame navigated url doesn't include the anchor
            if (url === requestedUrlNoAnchor || decodeURI(url) === requestedUrlNoAnchor) { // 'http://localhost:1234/test%20page' will use the not decoded version, 'http://localhost:1234/test page' will use the decoded version
                // Chrome started to navigate to the user's requested url
                this._userPageLaunched.resolve();
            } else if (url === 'chrome-error://chromewebdata/') {
                // Chrome couldn't retrieve the web-page in the requested url
                this._userPageLaunched.reject('UnreachableURL');
            } else if (url.startsWith('chrome-error://')) {
                // Uknown chrome error
                this._userPageLaunched.reject('UnknownChromeError');
            }
        }
    }

    constructor(
        @inject(TYPES.IBrowserNavigation) private readonly _browserNavigation: IBrowserNavigator,
        @inject(TYPES.IDebuggeeLauncher) private readonly _chromeLauncher: ChromeLauncher) {
        this.install();
    }
}