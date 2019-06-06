import * as _ from 'lodash';
import { utils } from 'vscode-chrome-debug-core';

// The VSTS agents run slower than our machines. Use this value to reduce proportinoally the timeouts in your dev machine
export const DefaultTimeoutMultiplier = parseFloat(_.defaultTo(process.env['TEST_TIMEOUT_MULTIPLIER'], '1'));

/**
 * Wait until the isReady condition evaluates to true. This method will evaluate it every 50 milliseconds until it returns true. It will time-out after maxWaitTimeInMilliseconds milliseconds
 */
export async function waitUntilReadyWithTimeout(isReady: () => boolean, maxWaitTimeInMilliseconds = DefaultTimeoutMultiplier * 30000 /* 30 seconds */) {
    const maximumDateTimeToWaitUntil = Date.now() + maxWaitTimeInMilliseconds;

    while (!isReady() && Date.now() < maximumDateTimeToWaitUntil) {
        await utils.promiseTimeout(undefined, 10 /*ms*/);
    }

    if (!isReady()) {
        throw new Error(`Timed-out after waiting for condition to be ready for ${maxWaitTimeInMilliseconds}ms. Condition: ${isReady}`);
    }
}