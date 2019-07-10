import * as _ from 'lodash';
import { createColumnNumber, createLineNumber, LineNumber } from '../core-v2/chrome/internal/locations/subtypes';
import { utils } from 'vscode-chrome-debug-core';
import { Position } from '../core-v2/chrome/internal/locations/location';

export async function findPositionOfTextInFile(filePath: string, text: string): Promise<Position> {
    const contentsIncludingCarriageReturns = await utils.readFileP(filePath, 'utf8');
    const contents = contentsIncludingCarriageReturns.replace(/\r/g, '');
    const textStartIndex = contents.indexOf(text);

    if (textStartIndex >= 0) {
        const textLineNumber = findLineNumber(contents, textStartIndex);
        const lastNewLineBeforeTextIndex = contents.lastIndexOf('\n', textStartIndex);
        const textColumNumber = createColumnNumber(textStartIndex - (lastNewLineBeforeTextIndex + 1));
        return new Position(textLineNumber, textColumNumber);
    } else {
        throw new Error(`Couldn't find ${text} in ${filePath}`);
    }
}

export function findLineNumber(contents: string, characterIndex: number): LineNumber {
    const contentsBeforeCharacter = contents.substr(0, characterIndex);
    const textLineNumber = createLineNumber(_.countBy(contentsBeforeCharacter, c => c === '\n')['true'] || 0);
    return textLineNumber;
}

