/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

/**
 * Type utilities to construct derived types from the original types, rather than have to manually write them
 */
export type MakePropertyRequired<T, K extends keyof T> = T & { [P in K]-?: T[K] };
export type RemoveProperty<T, K> = Pick<T, Exclude<keyof T, K>>;
export type SpecializeProperty<T, K extends keyof T, S extends T[K]> = T & { [P in K]: S };

export function isNotUndefined<T>(object: T | undefined): object is T {
    return object !== undefined;
}

export interface Array<T> {
    filter<U extends T>(predicate: (element: T) => element is U): U[];
}

export type Replace<T, R extends keyof T, N> = {
    [K in keyof T]: K extends R ? N : T[K];
};
