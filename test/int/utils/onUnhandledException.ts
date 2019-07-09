import { DebugClient } from 'vscode-debugadapter-testsupport';
import { DebugProtocol } from 'vscode-debugprotocol';

export function onUnhandledException(client: DebugClient, actionWhenUnhandledException: (exceptionMessage: string) => void): void {
    client.on('output', (args: DebugProtocol.OutputEvent) => {
        if (args.body.category === 'telemetry' && args.body.output === 'error') {
            actionWhenUnhandledException(`Debug adapter had an unhandled error: ${args.body.data.exceptionMessage}`);
        }
    });
}

export function onHandledError(client: DebugClient, actionWhenHandledError: (exceptionMessage: string) => void): void {
    client.on('output', (args: DebugProtocol.OutputEvent) => {
        if (args.body.category === 'stderr') {
            actionWhenHandledError(args.body.output);
        }
    });
}
