/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import { ISource, ILoadedSourceTreeNode, IScript, SourceScriptRelationship, utilities, ISourcesRetriever, SourceContents } from 'vscode-chrome-debug-core';
import { CDTPResourceContentGetter } from '../cdtpComponents/cdtpResourceContentGetter';
import * as _ from 'lodash';

/**
 * We use our own version of the ISourcesRetriever component which adds support for getting the source of .html files with potentially multiple inline scripts
 */
export class HTMLSourceRetriever implements ISourcesRetriever {
    constructor(
        private readonly _wrappedSourcesLogic: ISourcesRetriever,
        private readonly _resourceContentGetter: CDTPResourceContentGetter) { }

    public loadedSourcesTrees(): Promise<ILoadedSourceTreeNode[]> {
        return this._wrappedSourcesLogic.loadedSourcesTrees();
    }

    public loadedSourcesTreeForScript(script: IScript): ILoadedSourceTreeNode {
        return this._wrappedSourcesLogic.loadedSourcesTreeForScript(script);
    }

    public async text(source: ISource): Promise<SourceContents> {
        return source.tryResolving(
            async loadedSource => {
                if (loadedSource.sourceScriptRelationship === SourceScriptRelationship.SourceIsMoreThanAScript) {
                    const frameIds = _.uniq(loadedSource.scriptMapper().scripts.map(script => script.executionContext.frameId));

                    // For the time being we don't support iframes, so we assume that there is a single frameId in that collection
                    if (frameIds.length > 1) {
                        throw new Error(`iFrames are not currently supported. frame ids: ${JSON.stringify(frameIds)}`);
                    }

                    const contents = await this._resourceContentGetter.resourceContent({ url: loadedSource.url, frameId: utilities.singleElementOfArray(frameIds) });
                    return new SourceContents(contents);
                }
                return this._wrappedSourcesLogic.text(source);
            },
            () => this._wrappedSourcesLogic.text(source));
    }

    public async install(): Promise<this> {
        return this;
    }
}