/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as Validation from '../../../validation';
import { ColumnNumber, LineNumber, createLineNumber, createColumnNumber } from './subtypes';
import { IEquivalenceComparable } from '../../utils/equivalence';
import * as _ from 'lodash';

export type integer = number;

export class Position implements IEquivalenceComparable {
    public static readonly origin = new Position(createLineNumber(0), createColumnNumber(0));

    constructor(
        public readonly lineNumber: LineNumber,
        public readonly columnNumber: ColumnNumber) {
        Validation.zeroOrPositive('Line number', lineNumber);
        if (columnNumber !== undefined) {
            Validation.zeroOrPositive('Column number', columnNumber);
        }
    }

    public static appearingLastOf(...positions: Position[]): Position {
        const lastPosition = _.reduce(positions, (left, right) => left.doesAppearBefore(right) ? right : left);
        if (lastPosition !== undefined) {
            return lastPosition;
        } else {
            throw new Error(`Couldn't find the position appearing last from the list: ${positions}. Is it possible the list was empty?`);
        }
    }

    public static appearingFirstOf(...positions: Position[]): Position {
        const firstPosition =  _.reduce(positions, (left, right) => left.doesAppearBefore(right) ? left : right);
        if (firstPosition !== undefined) {
            return firstPosition;
        } else {
            throw new Error(`Couldn't find the position appearing first from the list: ${positions}. Is it possible the list was empty?`);
        }
    }

    public static isBetween(start: Position, maybeInBetween: Position, end: Position): boolean {
        return !maybeInBetween.doesAppearBefore(start) && !end.doesAppearBefore(maybeInBetween);
    }

    public isEquivalentTo(location: Position): boolean {
        return this.lineNumber === location.lineNumber
            && this.columnNumber === location.columnNumber;
    }

    public isOrigin(): boolean {
        return this.lineNumber === 0 && (this.columnNumber === undefined || this.columnNumber === 0);
    }

    public doesAppearBefore(right: Position): boolean {
        return this.lineNumber < right.lineNumber ||
            (this.lineNumber === right.lineNumber && this.columnNumber < right.columnNumber);
    }

    public toString(): string {
        return this.columnNumber !== undefined
            ? `${this.lineNumber}:${this.columnNumber}`
            : `${this.lineNumber}`;
    }
}
