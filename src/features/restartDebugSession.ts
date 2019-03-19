import { inject, TYPES, IBrowserNavigator } from 'vscode-chrome-debug-core';

export class RestartDebugSession {
    // TODO DIEGO: Implement mechanism for the debug adapters to declare handlers for events

    /**
     * Opt-in event called when the 'reload' button in the debug widget is pressed
     */
    public restart(): Promise<void> {
        return this._browserNavigation.reload({ ignoreCache: true });
    }

    constructor(@inject(TYPES.IBrowserNavigation) private readonly _browserNavigation: IBrowserNavigator) { }
}
