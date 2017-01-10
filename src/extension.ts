/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('extension.chrome-debug.addFrameToSkipFiles', addFrameToSkipFiles));
}

export function deactivate() {
}

function addFrameToSkipFiles(url: any): void {
    console.log(`addFrameToSkipFiles`);
    console.log(url);

    const socket = net.connect({ port: 7891 }, () => {
        socket.write(url);
    });

    socket.on("data", (data: any) => {
    });

    socket.on("error", function(reason: Error) {
        console.log(`socket error: ` + reason);
    });

    socket.on("end", function() {
        console.log(`socket end`);
    });
}
