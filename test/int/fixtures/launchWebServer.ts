/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { createServer } from 'http-server';
import { IFixture } from './fixture';
import { TestProjectSpec } from '../framework/frameworkTestSupport';
import { HttpOrHttpsServer } from '../types/server';
import { ILaunchRequestArgs } from 'vscode-chrome-debug-core';
import { logger } from 'vscode-debugadapter';
import { URL } from 'url';

async function createServerAsync(root: string): Promise<HttpOrHttpsServer> {
    const server = createServer({ root });
    return await new Promise((resolve, reject) => {
        logger.log(`About to launch web-server`);
        server.listen(0, '127.0.0.1', function (this: HttpOrHttpsServer, error?: any) {
            if (error) {
                reject(error);
            } else {
                resolve(this); // We return the this pointer which is the internal server object, which has access to the .address() method
            }
        });
    });
}

async function closeServer(server: HttpOrHttpsServer): Promise<void> {
    logger.log(`Closing web-server`);
    await new Promise((resolve, reject) => {
        server.close((error?: any) => {
            if (error) {
                logger.log('Error closing server in teardown: ' + (error && error.message));
                reject(error);
            } else {
                resolve();
            }
        });
    });
    logger.log(`Web-server closed`);
}

/**
 * Launch a web-server for the test project listening on the default port
 */
export class LaunchWebServer implements IFixture {
    private constructor(private readonly _server: HttpOrHttpsServer, private readonly _testSpec: TestProjectSpec) { }

    public static async launch(testSpec: TestProjectSpec): Promise<LaunchWebServer> {
        return new LaunchWebServer(await createServerAsync(testSpec.props.webRoot), testSpec);
    }

    public get url(): URL {
        const address = this._server.address();
        return new URL(`http://localhost:${address.port}/`);
    }

    public get launchConfig(): ILaunchRequestArgs {
        return Object.assign({}, this._testSpec.props.launchConfig, { url: this.url.toString() });
    }

    public get port(): number {
        return this._server.address().port;
    }

    public async cleanUp(): Promise<void> {
        await closeServer(this._server);
    }

    public toString(): string {
        return `LaunchWebServer`;
    }
}

export class ProvideStaticUrl implements IFixture {

    public constructor(public readonly url: URL, private readonly testSpec: TestProjectSpec) {}

    public get launchConfig(): any { // TODO: investigate why launch config types differ between V1 and V2
        return {...this.testSpec.props.launchConfig, url: this.url.href };
    }
    cleanUp() {}
}