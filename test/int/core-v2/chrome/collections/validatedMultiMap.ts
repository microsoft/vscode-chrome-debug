/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { ValidatedMap, IValidatedMap } from './validatedMap';
import { printMap } from './printing';
import { ValidatedSet, IValidatedSet } from './validatedSet';

/** A multi map that throws exceptions instead of returning error codes. */
export class ValidatedMultiMap<K, V> {

    public get keysSize(): number {
        return this._wrappedMap.size;
    }

    public get [Symbol.toStringTag](): 'Map' {
        return 'ValidatedMultiMap' as 'Map';
    }

    private constructor(private readonly _wrappedMap: IValidatedMap<K, IValidatedSet<V>>) { }

    public static empty<K, V>(): ValidatedMultiMap<K, V> {
        return this.usingCustomMap(new ValidatedMap<K, IValidatedSet<V>>());
    }

    public static withContents<K, V>(initialContents: Map<K, Set<V>> | Iterable<[K, Set<V>]> | ReadonlyArray<[K, Set<V>]>): ValidatedMultiMap<K, V> {
        const elements = Array.from(initialContents).map(element => <[K, IValidatedSet<V>]>[element[0], new ValidatedSet(element[1])]);
        return this.usingCustomMap(new ValidatedMap<K, IValidatedSet<V>>(elements));
    }

    public static usingCustomMap<K, V>(wrappedMap: IValidatedMap<K, IValidatedSet<V>>): ValidatedMultiMap<K, V> {
        return new ValidatedMultiMap(wrappedMap);
    }

    public clear(): void {
        this._wrappedMap.clear();
    }

    public delete(key: K): boolean {
        return this._wrappedMap.delete(key);
    }

    public forEach(callbackfn: (value: Set<V>, key: K, map: Map<K, Set<V>>) => void, thisArg?: any): void {
        this._wrappedMap.forEach(callbackfn, thisArg);
    }

    public get(key: K): Set<V> {
        return this._wrappedMap.get(key);
    }

    public getOr(key: K, elementDoesntExistAction: () => Set<V>): Set<V> {
        return this._wrappedMap.getOr(key, () => new ValidatedSet(elementDoesntExistAction()));
    }

    public has(key: K): boolean {
        return this._wrappedMap.has(key);
    }

    public addKeyIfNotExistant(key: K): this {
        const existingValues = this._wrappedMap.tryGetting(key);
        if (existingValues === undefined) {
            this._wrappedMap.set(key, new ValidatedSet());
        }

        return this;
    }

    public add(key: K, value: V): this {
        const existingValues = this._wrappedMap.tryGetting(key);
        if (existingValues !== undefined) {
            existingValues.add(value);
        } else {
            this._wrappedMap.set(key, new ValidatedSet([value]));
        }
        return this;
    }

    public addAndIgnoreDuplicates(key: K, value: V): this {
        const existingValues = this._wrappedMap.tryGetting(key);
        if (existingValues !== undefined) {
            existingValues.addOrReplaceIfExists(value);
        } else {
            this._wrappedMap.set(key, new ValidatedSet([value]));
        }
        return this;
    }

    public removeValueAndIfLastRemoveKey(key: K, value: V): this {
        const remainingValues = this.removeValue(key, value);

        if (remainingValues.size === 0) {
            this._wrappedMap.delete(key);
        }

        return this;
    }

    public removeValue(key: K, value: V): Set<V> {
        const existingValues = this._wrappedMap.get(key);
        if (!existingValues.delete(value)) {
            throw new Error(`Failed to delete the value ${value} under key ${key} because it wasn't present`);
        }

        return existingValues;
    }

    [Symbol.iterator](): IterableIterator<[K, Set<V>]> {
        return this._wrappedMap.entries();
    }

    public entries(): IterableIterator<[K, Set<V>]> {
        return this._wrappedMap.entries();
    }

    public keys(): IterableIterator<K> {
        return this._wrappedMap.keys();
    }

    public values(): IterableIterator<Set<V>> {
        return this._wrappedMap.values();
    }

    public tryGetting(key: K): Set<V> | undefined {
        return this._wrappedMap.tryGetting(key);
    }

    public toString(): string {
        return printMap('ValidatedMultiMap', this);
    }
}