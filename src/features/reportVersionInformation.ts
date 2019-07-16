/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import {
    utils as coreUtils, logger, telemetry, inject, TYPES, IDebuggeeStateInspector, ConnectedCDAConfiguration, INetworkCacheConfigurer, IDebuggeeRuntimeVersionProvider, IServiceComponent, injectable,
} from 'vscode-chrome-debug-core';
import { ICommonRequestArgs } from '../chromeDebugInterfaces';

export interface IVersionProperties {
    [key: string]: string;
}

@injectable()
export class ReportVersionInformation implements IServiceComponent {
    public async install(): Promise<this> {
        // Don't return this promise, a failure shouldn't fail attach
        this._inspectDebugeeState.evaluate({ expression: 'navigator.userAgent', silent: true })
            .then(
                evalResponse => logger.log('Target userAgent: ' + evalResponse.result.value),
                err => logger.log('Getting userAgent failed: ' + err.message))
            .then(() => {
                // TODO: Move this code to another class. It doesn't make sense for this code to be here
                const configDisableNetworkCache = (<ICommonRequestArgs>this._configuration.args).disableNetworkCache;
                const cacheDisabled = typeof configDisableNetworkCache === 'boolean' ?
                    configDisableNetworkCache :
                    true;

                this._networkCacheConfiguration.setCacheDisabled({ cacheDisabled }).catch(() => {
                    // Ignore failure
                });
            });

        const versionInformationPromise = this._debugeeVersionProvider.componentVersions().then(
            response => {
                const properties: IVersionProperties = {
                    'Versions.Target.CRDPVersion': response.crdp,
                    'Versions.Target.Revision': response.revision,
                    'Versions.Target.UserAgent': response.userAgent,
                    'Versions.Target.V8': response.v8
                };

                const parts = (response.product || '').split('/');
                if (parts.length === 2) { // Currently response.product looks like "Chrome/65.0.3325.162" so we split the project and the actual version number
                    properties['Versions.Target.Project'] = parts[0];
                    properties['Versions.Target.Version'] = parts[1];
                } else { // If for any reason that changes, we submit the entire product as-is
                    properties['Versions.Target.Product'] = response.product;
                }
                return properties;
            },
            err => {
                logger.log('Getting userAgent failed: ' + err.message);
                const properties = { 'Versions.Target.NoUserAgentReason': 'Error while retriving target user agent' } as telemetry.IExecutionResultTelemetryProperties;
                coreUtils.fillErrorDetails(properties, err);
                return properties;
            });

        // Send the versions information as it's own event so we can easily backfill other events in the user session if needed
        /* __GDPR__FRAGMENT__
           "VersionInformation" : {
              "Versions.Target.CRDPVersion" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
              "Versions.Target.Revision" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
              "Versions.Target.UserAgent" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
              "Versions.Target.V8" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
              "Versions.Target.V<NUMBER>" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
              "Versions.Target.Project" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
              "Versions.Target.Version" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
              "Versions.Target.Product" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
              "Versions.Target.NoUserAgentReason" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
              "${include}": [ "${IExecutionResultTelemetryProperties}" ]
           }
         */
        /* __GDPR__
           "target-version" : {
              "${include}": [ "${DebugCommonProperties}" ]
           }
         */
        versionInformationPromise.then(versionInformation => telemetry.telemetry.reportEvent('target-version', versionInformation));

        // TODO DIEGO: Reenable this code
        // try {
        //     if (this._breakOnLoadHelper) {
        //         // This is what -core is doing. We only actually care to see if this fails, to see if we need to apply the workaround
        //         const browserVersion = (await this._chromeConnection.version).browser;
        //         if (!browserVersion.isAtLeastVersion(0, 1)) { // If this is true it means it's unknown version
        //             logger.log(`/json/version failed, attempting workaround to get the version`);
        //             // If the original way failed, we try to use versionInformationPromise to get this information
        //             const versionInformation = await versionInformationPromise;
        //             const alternativeBrowserVersion = Version.parse(versionInformation['Versions.Target.Version']);
        //             this._breakOnLoadHelper.setBrowserVersion(alternativeBrowserVersion);
        //         }
        //     }
        // } catch (exception) {
        //     // If something fails we report telemetry and we ignore it
        //     telemetry.telemetry.reportEvent('break-on-load-target-version-workaround-failed', exception);
        // }

        /* __GDPR__FRAGMENT__
            "DebugCommonProperties" : {
                "${include}": [ "${VersionInformation}" ]
            }
        */
        telemetry.telemetry.addCustomGlobalProperty(versionInformationPromise);
        return this;
    }

    constructor(
        @inject(TYPES.IDebuggeeStateInspector) private readonly _inspectDebugeeState: IDebuggeeStateInspector,
        @inject(TYPES.ConnectedCDAConfiguration) private readonly _configuration: ConnectedCDAConfiguration,
        @inject(TYPES.INetworkCacheConfiguration) private readonly _networkCacheConfiguration: INetworkCacheConfigurer,
        @inject(TYPES.IDebuggeeRuntimeVersionProvider) private readonly _debugeeVersionProvider: IDebuggeeRuntimeVersionProvider) {
    }
}