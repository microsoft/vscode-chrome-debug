/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {createServer} from 'net';
import {WebKitDebugSession} from './webKitDebugSession';

// parse arguments
let port = 0;
let args = process.argv.slice(2);
args.forEach(function(val, index, array) {
    let portMatch = /^--server=(\d{2,5})$/.exec(val);
    if (portMatch !== null) {
        port = parseInt(portMatch[1], 10);
    }
});

// start session
let mock = new WebKitDebugSession(false);
if (port > 0) {
    console.error('waiting for v8 protocol on port ' + port);
    createServer(function(socket) {
        console.error('>> accepted connection from client');
        socket.on('end', () => {
            console.error('>> client connection closed');
        });
        mock.startDispatch(socket, socket);
    }).listen(port);
} else {
    console.error('waiting for v8 protocol on stdin/stdout');
    mock.startDispatch(process.stdin, process.stdout);
}
