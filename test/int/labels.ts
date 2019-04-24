/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BreakpointLocation } from './intTestSupport';
import * as fs from 'fs';
import * as util from 'util';
import * as readline from 'readline';
import * as path from 'path';
import { ValidatedMap, IValidatedMap } from './core-v2/chrome/collections/validatedMap';

/*
 * Contains classes and functions to find and use test breakpoint labels in test project files
 */

const readdirAsync = util.promisify(fs.readdir);

const labelRegex = /(\/\/|\/\*)\s*bpLabel:\s*(.+?)\b/;
const ignoreList = [ 'node_modules', '.git', path.join('dist', 'out'), path.join('testdata', 'react', 'src') ];

/**
 * A label in a source file that tells us where to put a breakpoint for a specific test
 */
export interface BreakpointLabel {
    label: string;
    location: BreakpointLocation;
}

/**
 * Load all breakpoint labels that exist in the 'projectRoot' directory
 * @param projectRoot Root directory for the test project
 */
export async function loadProjectLabels(projectRoot: string): Promise<IValidatedMap<string, BreakpointLocation>> {

    const labelMap = new ValidatedMap<string, BreakpointLocation>();
    if (containsIgnores(projectRoot)) return labelMap;

    const files = await readdirAsync(projectRoot);

    for (let file of files) {
        let subMap: Map<string, BreakpointLocation> | null = null;
        const fullPath = path.join(projectRoot, file);
        if (fs.lstatSync(fullPath).isDirectory()) {
            subMap = await loadProjectLabels(fullPath);
        } else {
            subMap = await loadLabelsFromFile(fullPath);
        }

        for (let entry of subMap.entries()) {
            labelMap.set(entry[0], entry[1]);
        }
    }

    return labelMap;
}

/**
 * Load breakpoint labels from a specific file
 * @param filePath
 */
export async function loadLabelsFromFile(filePath: string): Promise<Map<string, BreakpointLocation>> {
    const fileStream = fs.createReadStream(filePath);
    const labelMap = new Map<string, BreakpointLocation>();
    let lineNumber = 1; // breakpoint locations start at 1

    const lineReader = readline.createInterface({
        input: fileStream
    });

    lineReader.on('line', (fileLine) => {
        let match = labelRegex.exec(fileLine);

        if (match) {
            labelMap.set(match[2], new BreakpointLocation(filePath, lineNumber));
        }
        lineNumber++;
    });

    const waitForClose = new Promise((accept, _reject) => {
        lineReader.on('close', () => {
            accept();
        });
    });

    await waitForClose;
    return labelMap;
}

/**
 * Check if our filepath contains anything from our ignore list
 * @param filePath
 */
function containsIgnores(filePath: string) {
    return ignoreList.find(ignoreItem => filePath.includes(ignoreItem));
}