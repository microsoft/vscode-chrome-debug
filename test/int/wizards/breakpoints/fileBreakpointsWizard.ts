import { BreakpointWizard } from './breakpointWizard';
import { InternalFileBreakpointsWizard } from './implementation/internalFileBreakpointsWizard';
import { PromiseOrNot } from 'vscode-chrome-debug-core';
import { wrapWithMethodLogger } from '../../core-v2/chrome/logging/methodsCalledLogger';

export interface IBreakpointOptions {
    lineText: string;
}

export interface IHitCountBreakpointOptions extends IBreakpointOptions {
    hitCountCondition: string;
}

export class FileBreakpointsWizard {
    public constructor(private readonly _internal: InternalFileBreakpointsWizard) { }

    public async hitCountBreakpoint(options: IHitCountBreakpointOptions): Promise<BreakpointWizard> {
        return (await (await this.unsetHitCountBreakpoint(options)).setThenWaitForVerifiedThenValidate());
    }

    public async unsetHitCountBreakpoint(options: IHitCountBreakpointOptions): Promise<BreakpointWizard> {
        return wrapWithMethodLogger(await this._internal.hitCountBreakpoint({
            lineText: options.lineText,
            hitCountCondition: options.hitCountCondition,
            name: `BP @ ${options.lineText}`
        }));
    }

    public batch<T>(batchAction: (fileBreakpointsWizard: FileBreakpointsWizard) => PromiseOrNot<T>): Promise<T> {
        return this._internal.batch(batchAction);
    }

    public toString(): string {
        return `Breakpoints at ${this._internal.filePath}`;
    }
}
