/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { chromeConnection } from 'vscode-chrome-debug-core';
import { utils, chromeUtils } from 'vscode-chrome-debug-core';
import { logger } from 'vscode-chrome-debug-core';
import * as errors from './errors';

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

/**
 * Chrome connection class that supports launching with --remote-debugging-port=0 to get a random port for the debug session
 */
export class ChromeProvidedPortConnection extends chromeConnection.ChromeConnection {

    private userDataDir = undefined;
    setUserDataDir(userDataDir: string) {
        this.userDataDir = userDataDir;
    }

    /**
     * Attach the websocket to the first available tab in the chrome instance with the given remote debugging port number.
     * If we launched with port = 0, then this method will read the launched port from the user data directory, and wait until the port is open
     * before calling super.attach
     */
    public attach(address = '127.0.0.1', port = 9222, targetUrl?: string, timeout = chromeConnection.ChromeConnection.ATTACH_TIMEOUT, extraCRDPChannelPort?: number): Promise<void> {
        if (port === 0 && (this.userDataDir === undefined || this.userDataDir === '')) return errors.chromeProvidedPortWithoutUserDataDir();
        return utils.retryAsync(async () => {
            const launchedPort = (port === 0 && this.userDataDir) ? await this.getLaunchedPort(address, this.userDataDir) : port;
            return launchedPort;
        }, timeout, /*intervalDelay=*/200)
            .catch(err =>  Promise.reject(err))
            .then(launchedPort => {
                return super.attach(address, launchedPort, targetUrl, timeout, extraCRDPChannelPort);
        });
    }

    /**
     * Gets the port on which chrome was launched, and throw error if the port is not open or accepting connections
     * @param host The host address on which to check if the port is listening
     * @param userDataDir Chrome user data directory in which to check for a port file
     */
    private async getLaunchedPort(host: string, userDataDir: string): Promise<number> {
        logger.verbose('Looking for DevToolsActivePort file...');
        const launchedPort = await chromeUtils.getLaunchedPort(userDataDir);
        logger.verbose('Got the port, checking if its ready...');
        const portInUse = await chromeUtils.isPortInUse(launchedPort, host, 100);
        if (!portInUse) {
            // bail, the port isn't open
            logger.verbose('Port not open yet...');
            return errors.couldNotConnectToPort(host, launchedPort);
        }
        return launchedPort;
    }
}