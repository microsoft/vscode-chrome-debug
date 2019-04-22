import { DebugProtocol } from 'vscode-debugprotocol';

export type Script = DebugProtocol.Source;

export async function loadedSourcesContainsScript(loadedSources: Script[], scriptToFind: Script) : Promise<boolean> {
    let sourcesWithGivenNameAndPath = loadedSources.filter(source => (scriptToFind.name === source.name && scriptToFind.path === source.path));
    return sourcesWithGivenNameAndPath.length > 0;
}

export function createScriptItemFromInfo(name: string,
                                         path: string,
                                         sourceReference: number = null,
                                         presentationHint: any = null,
                                         origin: string = null,
                                         sources: DebugProtocol.Source[] = null,
                                         adapterData: any = null,
                                         checksums: DebugProtocol.Checksum[] = null): Script {
    return {name, path, sourceReference, presentationHint, origin, sources, adapterData, checksums};
}