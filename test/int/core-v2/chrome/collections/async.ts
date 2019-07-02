/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

export function asyncMap<T, U>(array: ReadonlyArray<T>,
    callbackfn: (value: T, index: number, array: ReadonlyArray<T>) => Promise<U> | U, thisArg?: any): Promise<U[]> {
    return Promise.all(array.map(callbackfn, thisArg));
}
