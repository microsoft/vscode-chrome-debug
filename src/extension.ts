/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('extension.chrome-debug.toggleSkippingFile', toggleSkippingFile));
}

export function deactivate() {
}

function toggleSkippingFile(path: string): void {
    if (!path) {
        const activeEditor = vscode.window.activeTextEditor;
        path = activeEditor && activeEditor.document.fileName;
    }

    vscode.commands.executeCommand('workbench.customDebugRequest', 'toggleSkipFileStatus', { path });
}
