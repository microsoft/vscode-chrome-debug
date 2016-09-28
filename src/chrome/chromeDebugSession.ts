/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as os from 'os';
import {DebugProtocol} from 'vscode-debugprotocol';
import {DebugSession, ErrorDestination, OutputEvent, Response} from 'vscode-debugadapter';

import {ChromeDebugAdapter} from './chromeDebugAdapter';
import {ITargetFilter, ChromeConnection} from './chromeConnection';
import {BasePathTransformer} from '../transformers/basePathTransformer';
import {BaseSourceMapTransformer} from '../transformers/baseSourceMapTransformer';
import {LineNumberTransformer} from '../transformers/lineNumberTransformer';

import {IDebugAdapter} from '../debugAdapterInterfaces';
import * as utils from '../utils';
import * as logger from '../logger';

export interface IChromeDebugSessionOpts {
    /** The class of the adapter, which is instantiated for each session */
    adapter: typeof ChromeDebugAdapter;
    extensionName: string;

    targetFilter?: ITargetFilter;
    logFilePath?: string;

    // Override services
    chromeConnection?: typeof ChromeConnection;
    pathTransformer?: typeof BasePathTransformer;
    sourceMapTransformer?: typeof BaseSourceMapTransformer;
    lineNumberTransformer?: typeof LineNumberTransformer;
}

export class ChromeDebugSession extends DebugSession {
    private _debugAdapter: IDebugAdapter;
    private _extensionName: string;

    /**
     * This needs a bit of explanation -
     * The Session is reinstantiated for each session, but consumers need to configure their instance of
     * ChromeDebugSession. Consumers should call getSession with their config options, then call
     * DebugSession.run with the result. Alternatively they could subclass ChromeDebugSession and pass
     * their options to the super constructor, but I think this is easier to follow.
     */
    public static getSession(opts: IChromeDebugSessionOpts): typeof ChromeDebugSession {
        // class expression!
        return class extends ChromeDebugSession {
            constructor(debuggerLinesAndColumnsStartAt1?: boolean, isServer?: boolean) {
                super(debuggerLinesAndColumnsStartAt1, isServer, opts);
            }
        };
    }

    public constructor(debuggerLinesAndColumnsStartAt1?: boolean, isServer?: boolean, opts?: IChromeDebugSessionOpts) {
        super();

        this._extensionName = opts.extensionName;
        this._debugAdapter = new (<any>opts.adapter)(opts);
        this._debugAdapter.registerEventHandler(this.sendEvent.bind(this));
        this._debugAdapter.registerRequestHandler(this.sendRequest.bind(this));

        const logFilePath =  opts.logFilePath;
        logger.init((msg, level) => this.onLog(msg, level), logFilePath, isServer);
        logVersionInfo();

        process.addListener('unhandledRejection', err => {
            // err is a DebugProtocol.Message or Error
            const errMsg = err.stack ? err.stack : JSON.stringify(err);
            logger.error(`******** Error in DebugAdapter - Unhandled promise rejection: ${errMsg}`);
        });
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
     * Overload sendRequest to log
     */
    public sendRequest(command: string, args: any, timeout: number, cb: (response: DebugProtocol.Response) => void): void {
        logger.verbose(`To client: ${JSON.stringify(command)}(${JSON.stringify(args)}), timeout: ${timeout}`);

        super.sendRequest(command, args, timeout, cb);
    }

    /**
     * Overload sendResponse to log
     */
    public sendResponse(response: DebugProtocol.Response): void {
        logger.verbose(`To client: ${JSON.stringify(response)}`);
        super.sendResponse(response);
    }

    public shutdown(): void {
        this._debugAdapter.shutdown();
        super.shutdown();
    }

    private onLog(msg: string, level: logger.LogLevel): void {
        const outputCategory = level === logger.LogLevel.Error ? 'stderr' : 'stdout';

        if (level === logger.LogLevel.Verbose) {
            // Distinguish verbose messages with this prefix - makes the logs much more readable
            msg = `  ›${msg}`;
        }

        this.sendEvent(new OutputEvent(msg + '\n', outputCategory));
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
                if (e.format) {
                    this.sendErrorResponse(response, e as DebugProtocol.Message);
                    return;
                }

                const eStr = e ? e.message : 'Unknown error';
                if (eStr === 'Error: unknowncommand') {
                    this.sendErrorResponse(response, 1014, `[${this._extensionName}] Unrecognized request: ${request.command}`, null, ErrorDestination.Telemetry);
                    return;
                }

                if (request.command === 'evaluate') {
                    // Errors from evaluate show up in the console or watches pane. Doesn't seem right
                    // as it's not really a failed request. So it doesn't need the [extensionName] tag and worth special casing.
                    response.message = eStr;
                } else {
                    // These errors show up in the message bar at the top (or nowhere), sometimes not obvious that they
                    // come from the adapter
                    response.message = `[${this._extensionName}] ${eStr}`;
                    logger.log('Error: ' + e ? e.stack : eStr);
                }

                response.success = false;
                this.sendResponse(response);
            });
    }

    /**
     * Overload dispatchRequest to the debug adapters' Promise-based methods instead of DebugSession's callback-based methods
     */
    protected dispatchRequest(request: DebugProtocol.Request): void {
        const response = new Response(request);
        try {
            logger.verbose(`From client: ${request.command}(${JSON.stringify(request.arguments) })`);

            const responseP = (request.command in this._debugAdapter) ?
                Promise.resolve(this._debugAdapter[request.command](request.arguments, request.seq)) :
                utils.errP('unknowncommand');

            this.sendResponseAsync(
                request,
                response,
                responseP);
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
