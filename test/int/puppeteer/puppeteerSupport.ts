/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*
* Functions that make puppeteer testing easier
*/

import * as util from 'util';
import * as request from 'request';
import * as puppeteer from 'puppeteer';

/**
 * Connect puppeteer to a currently running instance of chrome
 * @param port The port on which the chrome debugger is running
 */
export async function connectPuppeteer(port: number): Promise<puppeteer.Browser> {

    const resp = await util.promisify(request)(`http://localhost:${port}/json/version`);
    const { webSocketDebuggerUrl } = JSON.parse(resp.body);

    const browser = await puppeteer.connect({ browserWSEndpoint: webSocketDebuggerUrl, defaultViewport: null });
    return browser;
}

/**
 * Get the first (or only) page loaded in chrome
 * @param browser Puppeteer browser object
 */
export async function firstPage(browser: puppeteer.Browser): Promise<puppeteer.Page> {
    return (await browser.pages())[0];
}
