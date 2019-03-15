/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { ExtendedDebugClient } from 'vscode-chrome-debug-core-testsupport';

/*
 * A collection of supporting classes/functions for running framework tests
 */

/**
 * Specifies an integration test project (i.e. a project that will be launched and
 * attached to in order to test the debug adapter)
 */
export class TestProjectSpec {

    /**
     * @param projectRoot The root directory of the test project
     * @param launchConfig The default launch configuration for the test project
     * @param projectSrc Source files directory of the test project
     * @param webRoot The directory from which to host the project for a test
     * @param outFiles The outfiles directory for the test project
     */
    constructor(
        public readonly projectRoot: string,
        public readonly port: number = 7890,
        public readonly url: string = `http://localhost:${port}`,
        public readonly projectSrc: string = path.join(projectRoot, 'src'),
        public readonly webRoot: string = projectRoot,
        public readonly outFiles: string = path.join(projectRoot, 'out'),
        public readonly launchConfig: any = { url, outFiles, sourceMaps: true, webRoot }
    ) {}

    /**
     * Returns the full path to a source file
     * @param filename
     */
    src(filename: string) {
        return path.join(this.projectSrc, filename);
    }
}

/**
 * A wrapper for all the relevant context info needed to run a debug adapter test
 */
export interface FrameworkTestContext {
    /** The test project specs for the currently executing test suite */
    testSpec: TestProjectSpec;
    /** The debug adapter test support client */
    debugClient?: ExtendedDebugClient;
}
