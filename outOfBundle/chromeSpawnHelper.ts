/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as cp from 'child_process';

const chromePath = process.argv[2];
const chromeArgs = process.argv.slice(3);

console.log(`spawn('${chromePath}', ${JSON.stringify(chromeArgs) })`);
const chromeProc = cp.spawn(chromePath, chromeArgs, {
    stdio: ['ignore']
});

chromeProc.unref();
chromeProc.on('error', (err) => {
    const errMsg = 'Chrome error: ' + err;
    console.log(errMsg);
});
