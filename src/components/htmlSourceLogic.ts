/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import {
    SourceScriptRelationship, utilities, GetSourceTextRetrievability, IScriptSourcesRetriever,
    IPossiblyRetrievableText, ILoadedSource, RetrievableText, NonRetrievableText,
} from 'vscode-chrome-debug-core';
import { CDTPResourceContentGetter } from '../cdtpComponents/cdtpResourceContentGetter';
import * as _ from 'lodash';

/**
 * We use our own version of the ISourcesRetriever component which adds support for getting the source of .html files with potentially multiple inline scripts
 */
export function retrievabilityWithHTMLSupport(
    wrappedRetrievability: GetSourceTextRetrievability, scriptSources: IScriptSourcesRetriever,
    resourceContentGetter: CDTPResourceContentGetter, loadedSource: ILoadedSource): IPossiblyRetrievableText {
    const existingRetrievability = wrappedRetrievability(scriptSources, loadedSource);

    if (!existingRetrievability.isRetrievable && loadedSource.sourceScriptRelationship === SourceScriptRelationship.SourceIsMoreThanAScript) {
        const frameIds = _.uniq(loadedSource.scriptMapper().scripts.map(script => script.executionContext.frameId));

        // For the time being we don't support iframes, so we assume that there is a single frameId in that collection
        if (frameIds.length > 1) {
            return new NonRetrievableText(() => {
                throw new Error(`iFrames are not currently supported. frame ids: ${JSON.stringify(frameIds)}`);
            });
        }

        return new RetrievableText(() => resourceContentGetter.resourceContent({ url: loadedSource.url, frameId: utilities.singleElementOfArray(frameIds) }));
    }

    return existingRetrievability;
}