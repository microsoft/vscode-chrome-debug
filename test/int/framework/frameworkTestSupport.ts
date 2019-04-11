/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { ExtendedDebugClient } from 'vscode-chrome-debug-core-testsupport';
import { BreakpointLocation } from '../intTestSupport';

/*
 * A collection of supporting classes/functions for running framework tests
 */

export interface ProjectSpecProps {
    /** The root directory of the test project */
    projectRoot: string;
    /** Source files directory of the test project */
    projectSrc?: string;
    /** The directory from which to host the project for a test */
    webRoot?: string;
    /** The outfiles directory for the test project */
    outFiles?: string;
    /** The default launch configuration for the test project */
    launchConfig?: any;
    /** Port to use for the server */
    port?: number;
    /** Url to use for the project */
    url?: string;
}

/**
 * Specifies an integration test project (i.e. a project that will be launched and
 * attached to in order to test the debug adapter)
 */
export class TestProjectSpec {

    _props: ProjectSpecProps;
    get props() { return this._props; }

    /**
     * @param props Parameters for the project spec. The only required param is "projectRoot", others will be set to sensible defaults
     */
    constructor(props: ProjectSpecProps) {
        this._props = props;
        this._props.projectSrc = props.projectSrc || path.join(props.projectRoot, 'src');
        this._props.webRoot = props.webRoot || props.projectRoot;
        this._props.outFiles = props.outFiles || path.join(props.projectRoot, 'out');
        this._props.port = props.port || 7890;
        this._props.url = props.url || `http://localhost:${props.port}/`;
        this._props.launchConfig = props.launchConfig || {
            url: props.url,
            outFiles: props.outFiles,
            sourceMaps: true,
            /* TODO: get this dynamically */
            runtimeExecutable: 'node_modules/puppeteer/.local-chromium/win64-637110/chrome-win/chrome.exe',
            webRoot: props.webRoot
        };
    }

    /**
     * Returns the full path to a source file
     * @param filename
     */
    src(filename: string) {
        return path.join(this.props.projectSrc, filename);
    }
}

/**
 * A wrapper for all the relevant context info needed to run a debug adapter test
 */
export interface FrameworkTestContext {
    /** The test project specs for the currently executing test suite */
    testSpec: TestProjectSpec;
    /** A mapping of labels set in source files to a breakpoint location for a test */
    breakpointLabels?: Map<string, BreakpointLocation>;
    /** The debug adapter test support client */
    debugClient?: ExtendedDebugClient;
}
