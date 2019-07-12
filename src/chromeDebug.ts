/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as os from 'os';
import * as path from 'path';
import { ChromeDebugSession, logger, OnlyProvideCustomLauncherExtensibilityPoints, ISourcesRetriever, telemetry, UrlPathTransformer, TYPES, interfaces, GetComponentByID, DependencyInjection, UninitializedCDA, ISession } from 'vscode-chrome-debug-core';
import { ChromeDebugAdapter } from './chromeDebugAdapter';
import { ChromeLauncher } from './launcherAndRuner/chromeLauncher';
import { defaultTargetFilter } from './utils';
import { ChromeRunner } from './launcherAndRuner/chromeRunner';
import { ArgumentsUpdater } from './argumentsUpdater';
import { HTMLSourceRetriever } from './components/htmlSourceLogic';
import { CDTPResourceContentGetter } from './cdtpComponents/cdtpResourceContentGetter';
import { ShowOverlayWhenPaused, CDTPDeprecatedPage } from './features/showOverlayWhenPaused';
import { CustomizedUninitializedCDA } from './components/customizedUninitializedCDA';
import { ReportVersionInformation } from './features/reportVersionInformation';

const EXTENSION_NAME = 'debugger-for-chrome';

// Start a ChromeDebugSession configured to only match 'page' targets, which are Chrome tabs.
// Cast because DebugSession is declared twice - in this repo's vscode-debugadapter, and that of -core... TODO
const logFilePath = path.resolve(os.tmpdir(), 'vscode-chrome-debug.txt');

function customizeComponents<T>(identifier: interfaces.ServiceIdentifier<T>, component: T, getComponentById: GetComponentByID): T {
    switch (identifier) {
        case TYPES.ISourcesRetriever:
            // We use our own version of the ISourcesRetriever component which adds support for getting the source of .html files with potentially multiple inline scripts
            return <T><unknown>new HTMLSourceRetriever(<ISourcesRetriever><unknown>component, getComponentById(CDTPResourceContentGetter));
            case TYPES.UninitializedCDA:
            // We use our own version of the UninitializedCDA component to declare some extra capabilities that this client supports
            const session = <ISession>getComponentById(TYPES.ISession);
            return <T><unknown>new CustomizedUninitializedCDA(session, <UninitializedCDA><unknown>component);
        default:
            return component;
    }
}

// This class specifies the customizations that chrome-debug does to -core
const extensibilityPoints = new OnlyProvideCustomLauncherExtensibilityPoints(logFilePath, ChromeLauncher, ChromeRunner, customizeComponents);
extensibilityPoints.updateArguments = (scenario, args) => new ArgumentsUpdater().updateArguments(scenario, args);
extensibilityPoints.targetFilter = defaultTargetFilter;
extensibilityPoints.pathTransformer = UrlPathTransformer;
extensibilityPoints.bindAdditionalComponents = (diContainer: DependencyInjection) => {
    diContainer.configureClass(TYPES.IServiceComponent, ShowOverlayWhenPaused);
    diContainer.configureClass(TYPES.IServiceComponent, ReportVersionInformation);
    diContainer.configureClass(CDTPDeprecatedPage, CDTPDeprecatedPage);
};

ChromeDebugSession.run(ChromeDebugSession.getSession(
    {
        adapter: ChromeDebugAdapter,
        extensionName: EXTENSION_NAME,
        logFilePath: logFilePath,
        extensibilityPoints: extensibilityPoints
    }));

/* tslint:disable:no-var-requires */
const debugAdapterVersion = require('../../package.json').version;
logger.log(EXTENSION_NAME + ': ' + debugAdapterVersion);

/* __GDPR__FRAGMENT__
    "DebugCommonProperties" : {
        "Versions.DebugAdapter" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
    }
*/
telemetry.telemetry.addCustomGlobalProperty({ 'Versions.DebugAdapter': debugAdapterVersion });
