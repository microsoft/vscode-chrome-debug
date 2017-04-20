/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import * as Core from 'vscode-chrome-debug-core';

import {targetFilter} from './utils';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('extension.chrome-debug.toggleSkippingFile', toggleSkippingFile));
    context.subscriptions.push(vscode.commands.registerCommand('extension.chrome-debug.startSession', startSession));
}

export function deactivate() {
}

function toggleSkippingFile(path: string): void {
    if (!path) {
        const activeEditor = vscode.window.activeTextEditor;
        path = activeEditor && activeEditor.document.fileName;
    }

    const args: Core.IToggleSkipFileStatusArgs = typeof path === 'string' ? { path } : { sourceReference: path };
    vscode.commands.executeCommand('workbench.customDebugRequest', 'toggleSkipFileStatus', args);
}

interface StartSessionResult {
    status: 'ok' | 'initialConfiguration' | 'saveConfiguration';
    content?: string;	// launch.json content for 'save'
};

async function startSession(config: any): Promise<StartSessionResult> {
    if (config.request === 'attach') {
        const discovery = new Core.chromeTargetDiscoveryStrategy.ChromeTargetDiscovery(
            new Core.NullLogger(), new Core.telemetry.NullTelemetryReporter());

        const targets = await discovery.getAllTargets(config.address || '127.0.0.1', config.port, targetFilter, config.url);
        if (targets.length > 1) {
            const selectedTarget = await pickTarget(targets);
            if (!selectedTarget) {
                // Quickpick canceled, bail
                return;
            }

            config.websocketUrl = selectedTarget.websocketDebuggerUrl;
        }
    }

    vscode.commands.executeCommand('vscode.startDebug', config);

    return Promise.resolve<StartSessionResult>({ status: 'ok' });
}

interface ITargetQuickPickItem extends vscode.QuickPickItem {
    websocketDebuggerUrl: string;
}

async function pickTarget(targets: Core.chromeConnection.ITarget[]): Promise<ITargetQuickPickItem> {
    const items = targets.map(target => (<ITargetQuickPickItem>{
        label: unescapeTargetTitle(target.title),
        detail: target.url,
        websocketDebuggerUrl: target.webSocketDebuggerUrl
    }));

    const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Select a tab', matchOnDescription: true, matchOnDetail: true });
    return selected;
}

function unescapeTargetTitle(title: string): string {
    return title
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, `'`)
        .replace(/&quot;/g, '"');
}