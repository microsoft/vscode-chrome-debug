/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import { TYPES, inject, injectable, CDTPEnableableDiagnosticsModule, CDTP, CDTPDomainsEnabler, IExecutionContextEventsProvider, SourceContents } from 'vscode-chrome-debug-core';
import * as _ from 'lodash';

/**
 * Chrome API to get the contents of a web-page resource. We use this to obtain the contents of an .html file which has inline scripts inside
 */
@injectable()
export class CDTPResourceContentGetter extends CDTPEnableableDiagnosticsModule<CDTP.PageApi>  {
    protected api = this._protocolApi.Page;

    constructor(
        @inject(TYPES.CDTPClient)
        protected _protocolApi: CDTP.ProtocolApi,
        @inject(TYPES.IDomainsEnabler) domainsEnabler: CDTPDomainsEnabler,
        @inject(TYPES.ExecutionContextEventsProvider) executionContextEventsProvider: IExecutionContextEventsProvider,
    ) {
        super(domainsEnabler);

        executionContextEventsProvider.onExecutionContextCreated(executionContext => {
            this.enable().then(() =>
            /* The first time we call getResourceContent it reloads all resources in case any was evicted from the cache. If the debuggee is paused while that happens,
            then getResourceContent will get blocked because it won't be able to execute network requests while the application is paused.

            Normally this creates an issue when we try to request the source of a dynamic html web-page while we are paused.
            We call getResourceContent with some dummy parameters as part of the debugger setup, so the first call will happen on the about:blank page before we are paused, so we won't
            run into any blocking issues. The second and further calls to getResourceContent won't get blocked after that.

            Experimentally we saw that we need to call this for each execution context for this to work.
            */
            this.api.getResourceContent({frameId: executionContext.frameId, url: ''})).catch(() => {});
    });
    }

    public async resourceContent(params: CDTP.Page.GetResourceContentRequest): Promise<SourceContents> {
        return new SourceContents((await this.api.getResourceContent(params)).content);
    }
}
