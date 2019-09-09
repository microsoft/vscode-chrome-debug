/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import { inject, injectable, TYPES, IBrowserNavigator, ICommandHandlerDeclarer, CommandHandlerDeclaration, ICommandHandlerDeclaration } from 'vscode-chrome-debug-core';

@injectable()
export class RestartDebugSession implements ICommandHandlerDeclarer {
    getCommandHandlerDeclarations(): ICommandHandlerDeclaration[] {
        return CommandHandlerDeclaration.fromLiteralObject({
            restart: () => this.restart()
        });
    }

    /**
     * Opt-in event called when the 'reload' button in the debug widget is pressed
     */
    public restart(): Promise<void> {
        return this._browserNavigation.reload({ ignoreCache: true });
    }

    constructor(@inject(TYPES.IBrowserNavigation) private readonly _browserNavigation: IBrowserNavigator) { }
}
