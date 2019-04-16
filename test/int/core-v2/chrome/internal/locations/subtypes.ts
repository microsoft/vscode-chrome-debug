/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

// We use these types to have the compiler check that we are not sending a ColumnNumber where a LineNumber is expected

const lineIndexSymbol = Symbol();
export type LineNumber = number & { [lineIndexSymbol]: true };

export function createLineNumber(numberRepresentation: number): LineNumber {
    return <LineNumber>numberRepresentation;
}

const columnIndexSymbol = Symbol();
export type ColumnNumber = number & { [columnIndexSymbol]: true };

export function createColumnNumber(numberRepresentation: number): ColumnNumber  {
    return <ColumnNumber>numberRepresentation;
}

const URLRegexpSymbol = Symbol();
export type URLRegexp = string & { [URLRegexpSymbol]: true };

export function createURLRegexp(textRepresentation: string): URLRegexp {
    return <URLRegexp>textRepresentation;
}