/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import * as Core from 'vscode-chrome-debug-core';
import * as nls from 'vscode-nls';
import * as path from 'path';

import { defaultTargetFilter, getTargetFilter } from './utils';

const localize = nls.loadMessageBundle();

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('extension.chrome-debug.toggleSkippingFile', toggleSkippingFile));
    context.subscriptions.push(vscode.commands.registerCommand('extension.chrome-debug.toggleSmartStep', toggleSmartStep));

    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('legacy-chrome', new ChromeConfigurationProvider()));
}

export function deactivate() {
}

export class ChromeConfigurationProvider implements vscode.DebugConfigurationProvider {
    /**
     * Try to add all missing attributes to the debug configuration being launched.
     */
    async resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration, token?: vscode.CancellationToken): Promise<vscode.DebugConfiguration> {
        // if launch.json is missing or empty
        if (!config.type && !config.request && !config.name) {
            // Return null so it will create a launch.json and fall back on provideDebugConfigurations - better to point the user towards the config
            // than try to work automagically.
            return null;
        }

        if (config.request === 'attach') {
            const discovery = new Core.chromeTargetDiscoveryStrategy.ChromeTargetDiscovery(
                new Core.NullLogger(), new Core.telemetry.NullTelemetryReporter());

            let targets;
            try {
                targets = await discovery.getAllTargets(config.address || '127.0.0.1', config.port, config.targetTypes === undefined ? defaultTargetFilter : getTargetFilter(config.targetTypes), config.url || config.urlFilter);
            } catch (e) {
                // Target not running?
            }

            if (targets && targets.length > 1) {
                const selectedTarget = await pickTarget(targets);
                if (!selectedTarget) {
                    // Quickpick canceled, bail
                    return null;
                }

                config.websocketUrl = selectedTarget.websocketDebuggerUrl;
            }
        }

        resolveRemoteUris(folder, config);
        return config;
    }
}

// Must match the strings in -core's remoteMapper.ts
const remoteUriScheme = 'vscode-remote';
const remotePathComponent = '__vscode-remote-uri__';

const isWindows = process.platform === 'win32';
function getFsPath(uri: vscode.Uri): string {
    const fsPath = uri.fsPath;
    return isWindows && !fsPath.match(/^[a-zA-Z]:/) ?
        fsPath.replace(/\\/g, '/') : // Hack - undo the slash normalization that URI does when windows is the current platform
        fsPath;
}

function mapRemoteClientUriToInternalPath(remoteUri: vscode.Uri): string {
    const uriPath = getFsPath(remoteUri);
    const driveLetterMatch = uriPath.match(/^[A-Za-z]:/);
    let internalPath: string;
    if (!!driveLetterMatch) {
        internalPath = path.win32.join(driveLetterMatch[0], remotePathComponent, uriPath.substr(2));
    } else {
        internalPath = path.posix.join('/', remotePathComponent, uriPath);
    }

    return internalPath;
}

function rewriteWorkspaceRoot(configObject: any, internalWorkspaceRootPath: string): void {
    for (const key in configObject) {
        if (typeof configObject[key] === 'string') {
            configObject[key] = configObject[key].replace(/\$\{workspace(Root|Folder)\}/g, internalWorkspaceRootPath);
        } else {
            rewriteWorkspaceRoot(configObject[key], internalWorkspaceRootPath);
        }
    }
}

function resolveRemoteUris(folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration): void {
    if (folder && folder.uri.scheme === remoteUriScheme) {
        const internalPath = mapRemoteClientUriToInternalPath(folder.uri);
        rewriteWorkspaceRoot(config, internalPath);
        (<any>config).remoteAuthority = folder.uri.authority;
    }
}

function toggleSkippingFile(aPath: string): void {
    if (!aPath) {
        const activeEditor = vscode.window.activeTextEditor;
        aPath = activeEditor && activeEditor.document.fileName;
    }

    if (aPath && vscode.debug.activeDebugSession) {
        const args: Core.IToggleSkipFileStatusArgs = typeof aPath === 'string' ? { path: aPath } : { sourceReference: aPath };
        vscode.debug.activeDebugSession.customRequest('toggleSkipFileStatus', args);
    }
}

function toggleSmartStep(): void {
    if (vscode.debug.activeDebugSession) {
        vscode.debug.activeDebugSession.customRequest('toggleSmartStep');
    }
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

    const placeHolder = localize('chrome.targets.placeholder', 'Select a tab');
    const selected = await vscode.window.showQuickPick(items, { placeHolder, matchOnDescription: true, matchOnDetail: true });
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
