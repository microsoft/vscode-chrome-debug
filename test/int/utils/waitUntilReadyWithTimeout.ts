import { utils } from 'vscode-chrome-debug-core';

export async function waitUntilReadyWithTimeout(isReady: () => boolean, maxWaitTimeInMilliseconds = 30000 /* 30 seconds */) {
    const maximumDateTimeToWaitUntil = Date.now() + maxWaitTimeInMilliseconds;

    while (!isReady() && Date.now() < maximumDateTimeToWaitUntil) {
        await utils.promiseTimeout(undefined, 50);
    }

    if (!isReady()) {
        throw new Error(`Timed-out after waiting for condition to be ready for ${maxWaitTimeInMilliseconds}ms. Condition: ${isReady}`);
    }
}