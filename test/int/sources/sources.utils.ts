import { DebugProtocol } from 'vscode-debugprotocol';
import { ValidatedMap } from '../core-v2/chrome/collections/validatedMap';
import assert = require('assert');

export type Script = DebugProtocol.Source;
export type LoadedSourceEvent = DebugProtocol.LoadedSourceEvent;

export async function loadedSourcesContainsScript(loadedSources: Script[], scriptToFind: Script) : Promise<boolean> {
    let sourcesWithGivenNameAndPath = loadedSources.filter(source => (scriptToFind.name === source.name && scriptToFind.path === source.path));
    return sourcesWithGivenNameAndPath.length > 0;
}

export function createScriptItemFromInfo(name: string,
                                         path: string,
                                         sourceReference?: number,
                                         presentationHint?: any,
                                         origin?: string,
                                         sources?: DebugProtocol.Source[],
                                         adapterData?: any,
                                         checksums?: DebugProtocol.Checksum[]): Script {
    return {name, path, sourceReference, presentationHint, origin, sources, adapterData, checksums};
}

export class SourcesChecker {
    private _loadedSourcesCount = 0;

    public constructor() {
    }

    public updateSourcesCount(sourcesChangeValue: number): void {
        this._loadedSourcesCount+=sourcesChangeValue;
    }

    public assertNewSource(event: LoadedSourceEvent): void {
        assert.equal(event['body'].reason, 'new');
    }

    public assertLoadedSourceCountIs(count: number): void {
        assert.equal(this._loadedSourcesCount, count);
    }

    public resetLoadedSourcesCount() {
        this._loadedSourcesCount = 0;
    }

}