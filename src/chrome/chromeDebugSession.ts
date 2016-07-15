/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as os from 'os';
import {DebugProtocol} from 'vscode-debugprotocol';
import {DebugSession, ErrorDestination, OutputEvent} from 'vscode-debugadapter';

import {IDebugAdapter} from '../debugAdapterInterfaces';
import {ChromeDebugAdapter} from './chromeDebugAdapter';
import {ChromeConnection, ITargetFilter} from './chromeConnection';
import {getChromeTargetWebSocketURL} from './chromeTargetDiscoveryStrategy';

import * as logger from '../logger';

import {AdapterProxy} from '../adapterProxy';
import {LineNumberTransformer} from '../transformers/lineNumberTransformer';
import {PathTransformer} from '../transformers/pathTransformer';
import {SourceMapTransformer} from '../transformers/sourceMapTransformer';

export interface IChromeDebugSessionOpts {
    adapter?: IDebugAdapter;
    targetFilter?: ITargetFilter;
    logFilePath?: string;
}

export class ChromeDebugSession extends DebugSession {
    private _adapterProxy: AdapterProxy;

    /**
     * This needs a bit of explanation -
     * We call DebugSession.run to create the connection to VS Code, which takes a Class extending DebugSession,
     * not an instance. That's problematic because a class can't be naturally configured the way an instance
     * would be. So this factory function dynamically creates a class which has 'opts' in a closure and can
     * instantiate ChromeDebugSession with it. Otherwise all consumers would need to subclass ChromeDebugSession
     * in a sort of non-obvious way.
     */
    public static getSession(opts: IChromeDebugSessionOpts): typeof ChromeDebugSession {
        // class expression!
        return class extends ChromeDebugSession {
            constructor(
                targetLinesStartAt1: boolean,
                isServer = false) {
                super(targetLinesStartAt1, isServer, opts);
            }
        };
    }

    public constructor(
        targetLinesStartAt1: boolean,
        isServer = false,
        opts: IChromeDebugSessionOpts = {}) {
        super(targetLinesStartAt1, isServer);

        const connection = new ChromeConnection(getChromeTargetWebSocketURL, opts.targetFilter);
        const adapter = opts.adapter || new ChromeDebugAdapter(connection);
        const logFilePath =  opts.logFilePath;

        logger.init((msg, level) => this.onLog(msg, level), logFilePath);
        logVersionInfo();

        process.addListener('unhandledRejection', reason => {
            logger.error(`******** Error in DebugAdapter - Unhandled promise rejection: ${reason}`);
        });

        this._adapterProxy = new AdapterProxy(
            [
                new LineNumberTransformer(targetLinesStartAt1),
                new SourceMapTransformer(),
                new PathTransformer()
            ],
            adapter,
            event => this.sendEvent(event));
    }

    /**
     * Overload sendEvent to log
     */
    public sendEvent(event: DebugProtocol.Event): void {
        if (event.event !== 'output') {
            // Don't create an infinite loop...
            logger.verbose(`To client: ${JSON.stringify(event)}`);
        }

        super.sendEvent(event);
    }

    /**
     * Overload sendResponse to log
     */
    public sendResponse(response: DebugProtocol.Response): void {
        logger.verbose(`To client: ${JSON.stringify(response)}`);
        super.sendResponse(response);
    }

    private onLog(msg: string, level: logger.LogLevel): void {
        const outputCategory = level === logger.LogLevel.Error ? 'stderr' : undefined;
        this.sendEvent(new OutputEvent(`  ›${msg}\n`, outputCategory));
    }

    /**
     * Takes a response and a promise to the response body. If the promise is successful, assigns the response body and sends the response.
     * If the promise fails, sets the appropriate response parameters and sends the response.
     */
    private sendResponseAsync(request: DebugProtocol.Request, response: DebugProtocol.Response, responseP: Promise<any>): void {
        responseP.then(
            (body?) => {
                response.body = body;
                this.sendResponse(response);
            },
            e => {
                const eStr = e ? e.message : 'Unknown error';
                if (eStr === 'Error: unknowncommand') {
                    this.sendErrorResponse(response, 1014, '[debugger-for-chrome] Unrecognized request: ' + request.command, null, ErrorDestination.Telemetry);
                    return;
                }

                if (request.command === 'evaluate') {
                    // Errors from evaluate show up in the console or watches pane. Doesn't seem right
                    // as it's not really a failed request. So it doesn't need the tag and worth special casing.
                    response.message = eStr;
                } else {
                    // These errors show up in the message bar at the top (or nowhere), sometimes not obvious that they
                    // come from the adapter
                    response.message = '[debugger-for-chrome] ' + eStr;
                    logger.log('Error: ' + e ? e.stack : eStr);
                }

                response.success = false;
                this.sendResponse(response);
            });
    }

    /**
     * Overload dispatchRequest to dispatch to the adapter proxy instead of debugSession's methods for each request.
     */
    protected dispatchRequest(request: DebugProtocol.Request): void {
        const response = new Response(request);
        try {
            logger.verbose(`From client: ${request.command}(${JSON.stringify(request.arguments) })`);
            this.sendResponseAsync(
                request,
                response,
                this._adapterProxy.dispatchRequest(request));
        } catch (e) {
            this.sendErrorResponse(response, 1104, 'Exception while processing request (exception: {_exception})', { _exception: e.message }, ErrorDestination.Telemetry);
        }
    }
}

function logVersionInfo(): void {
    logger.log(`OS: ${os.platform()} ${os.arch()}`);
    logger.log('Node: ' + process.version);
    logger.log('vscode-chrome-debug-core: ' + require('../../../package.json').version);
}

/**
 * Classes copied from vscode-debugadapter - consider exporting these instead
 */

class Message implements DebugProtocol.ProtocolMessage {
    public seq: number;
    public type: string;

    public constructor(type: string) {
        this.seq = 0;
        this.type = type;
    }
}

class Response extends Message implements DebugProtocol.Response {
    public request_seq: number;
    public success: boolean;
    public command: string;

    public constructor(request: DebugProtocol.Request, message?: string) {
        super('response');
        this.request_seq = request.seq;
        this.command = request.command;
        if (message) {
            this.success = false;
            (<any>this).message = message;
        } else {
            this.success = true;
        }
    }
}
