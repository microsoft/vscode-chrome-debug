/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import { ILaunchRequestArgs, IAttachRequestArgs } from './chromeDebugInterfaces';
import * as utils from './utils';
import { ISourceMapPathOverrides, logger, ScenarioType } from 'vscode-chrome-debug-core';

// Keep in sync with sourceMapPathOverrides package.json default
const DefaultWebSourceMapPathOverrides: ISourceMapPathOverrides = {
    'webpack:///./~/*': '${webRoot}/node_modules/*',
    'webpack:///./*': '${webRoot}/*',
    'webpack:///*': '*',
    'webpack:///src/*': '${webRoot}/*',
    'meteor://💻app/*': '${webRoot}/*'
};

/**
 * Update the launch.json arguments before they are processed by -core
 */
export class ArgumentsUpdater {
    public updateArguments<T extends ILaunchRequestArgs | IAttachRequestArgs>(scenarioType: ScenarioType, argumentsFromClient: T): T {
        const args = argumentsFromClient;

        if (args.webRoot && (!args.pathMapping || !args.pathMapping['/'])) {
            args.pathMapping = args.pathMapping || {};
            args.pathMapping['/'] = args.webRoot;
        }

        args.sourceMaps = typeof args.sourceMaps === 'undefined' || args.sourceMaps;
        args.sourceMapPathOverrides = this.getSourceMapPathOverrides(args.webRoot, args.sourceMapPathOverrides);
        args.skipFileRegExps = ['^chrome-extension:.*'];

        if (args.targetTypes === undefined) {
            args.targetFilter = utils.defaultTargetFilter;
        } else {
            args.targetFilter = utils.getTargetFilter(args.targetTypes);
        }

        if (scenarioType === ScenarioType.Attach && args.urlFilter) {
            args.url = args.urlFilter;
        }

        return <T>args;
    }

    private getSourceMapPathOverrides(webRoot: string | undefined, sourceMapPathOverrides?: ISourceMapPathOverrides): ISourceMapPathOverrides {
        return sourceMapPathOverrides ? this.resolveWebRootPattern(webRoot, sourceMapPathOverrides, /*warnOnMissing=*/true) :
            this.resolveWebRootPattern(webRoot, DefaultWebSourceMapPathOverrides, /*warnOnMissing=*/false);
    }

    /**
     * Returns a copy of sourceMapPathOverrides with the ${webRoot} pattern resolved in all entries.
     *
     * dynamically required by test
     */
    /// TODO: Refactor this, possibly not making it a public method in this class. It might be a public method in a different class
    public resolveWebRootPattern(webRoot: string | undefined, sourceMapPathOverrides: ISourceMapPathOverrides, warnOnMissing: boolean): ISourceMapPathOverrides {
        const resolvedOverrides: ISourceMapPathOverrides = {};
        for (let pattern in sourceMapPathOverrides) {
            const replacePattern = this.replaceWebRootInSourceMapPathOverridesEntry(webRoot, pattern, warnOnMissing);
            const replacePatternValue = this.replaceWebRootInSourceMapPathOverridesEntry(webRoot, sourceMapPathOverrides[pattern], warnOnMissing);

            resolvedOverrides[replacePattern] = replacePatternValue;
        }

        return resolvedOverrides;
    }

    private replaceWebRootInSourceMapPathOverridesEntry(webRoot: string | undefined, entry: string, warnOnMissing: boolean): string {
        const webRootIndex = entry.indexOf('${webRoot}');
        if (webRootIndex === 0) {
            if (webRoot) {
                return entry.replace('${webRoot}', webRoot);
            } else if (warnOnMissing) {
                logger.log('Warning: sourceMapPathOverrides entry contains ${webRoot}, but webRoot is not set');
            }
        } else if (webRootIndex > 0) {
            logger.log('Warning: in a sourceMapPathOverrides entry, ${webRoot} is only valid at the beginning of the path');
        }

        return entry;
    }
}
