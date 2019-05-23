/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { createServer } from 'http-server';
import { IFixture } from './fixture';
import { TestProjectSpec } from '../framework/frameworkTestSupport';
import { HttpOrHttpsServer } from '../types/server';

/**
 * Launch a web-server for the test project listening on the default port
 */
export class LaunchWebServer implements IFixture {
    private readonly server: HttpOrHttpsServer;

    public constructor(testSpec: TestProjectSpec) {
        this.server = createServer({ root: testSpec.props.webRoot });
        // TODO: This should probably be extracted somehow and randomized at some point (Also replace 7890 in the url)
        this.server.listen(7890);
    }

    public async cleanUp(): Promise<void> {
        this.server.close(err => console.log('Error closing server in teardown: ' + (err && err.message)));
    }

    public toString(): string {
        return `LaunchWebServer`;
    }
}