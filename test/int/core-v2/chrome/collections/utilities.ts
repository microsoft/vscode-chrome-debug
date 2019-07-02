/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { ValidatedMultiMap } from './validatedMultiMap';

export function groupByKey<T, K>(elements: T[], obtainKey: (element: T) => K): ValidatedMultiMap<K, T> {
    const grouped = ValidatedMultiMap.empty<K, T>();
    elements.forEach(element => grouped.add(obtainKey(element), element));
    return grouped;
}

export function determineOrderingOfStrings(left: string, right: string): number {
    if (left < right) {
        return -1;
    } else if (left > right) {
        return 1;
    } else {
        return 0;
    }
}

export function singleElementOfArray<T>(array: ReadonlyArray<T>): T {
    if (array.length === 1) {
        return array[0];
    } else {
        throw new Error(`Expected array ${array} to have exactly a single element yet it had ${array.length}`);
    }
}