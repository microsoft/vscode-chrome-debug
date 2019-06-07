/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*
* Functions that make puppeteer testing easier
*/

import * as request from 'request-promise-native';
import * as puppeteer from 'puppeteer';

/**
 * Connect puppeteer to a currently running instance of chrome
 * @param port The port on which the chrome debugger is running
 */
export async function connectPuppeteer(port: number): Promise<puppeteer.Browser> {

    const resp = await request(`http://localhost:${port}/json/version`);
    const { webSocketDebuggerUrl } = JSON.parse(resp);

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

/**
 * Get a page in the browser by the url
 * @param browser Puppeteer browser object
 * @param url The url of the desired page
 * @param timeout Timeout in milliseconds
 */
export async function getPageByUrl(browser: puppeteer.Browser, url: string, timeout = 5000): Promise<puppeteer.Page> {

    let before = new Date().getTime();
    let current = before;

    // poll for the desired page url. If we don't find it within the timeout, throw an error
    while ((current - before) < timeout) {

        const pages = await browser.pages();
        const desiredPage = pages.find(p => p.url().toLowerCase() === url.toLowerCase());
        if (desiredPage) {
            return desiredPage;
        }

        // TODO: yuck, clean up
        await new Promise((a, _r) =>  setTimeout(() => a(), timeout / 10));
        current = new Date().getTime();
    }
    throw `Page with url: ${url} could not be found within ${timeout}ms`;
}
