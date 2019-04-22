import { DebugProtocol } from 'vscode-debugprotocol';

export type Script = DebugProtocol.Source;

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