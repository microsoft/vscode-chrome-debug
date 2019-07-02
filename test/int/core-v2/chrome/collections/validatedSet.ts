import { printSet } from './printing';
import { breakWhileDebugging } from '../../validation';

export interface IValidatedSet<K> extends Set<K> {
    addOrReplaceIfExists(key: K): this;
    deleteIfExists(key: K): boolean;
    toArray(): K[];
}

/** A set that throws exceptions instead of returning error codes. */
export class ValidatedSet<K> implements IValidatedSet<K> {
    private readonly _wrappedSet: Set<K>;

    public constructor();
    public constructor(iterable: Iterable<K>);
    public constructor(values?: ReadonlyArray<K>);
    public constructor(valuesOrIterable?: ReadonlyArray<K> | undefined | Iterable<K>) {
        this._wrappedSet = valuesOrIterable
            ? new Set(valuesOrIterable)
            : new Set();
    }

    public get size(): number {
        return this._wrappedSet.size;
    }

    public get [Symbol.toStringTag](): 'Set' {
        return 'ValidatedSet' as 'Set';
    }

    public clear(): void {
        this._wrappedSet.clear();
    }

    public delete(key: K): boolean {
        if (!this._wrappedSet.delete(key)) {
            breakWhileDebugging();
            throw new Error(`Couldn't delete element with key ${key} because it wasn't present in the set`);
        }

        return true;
    }

    public deleteIfExists(key: K): boolean {
        return this._wrappedSet.delete(key);
    }

    public forEach(callbackfn: (key: K, sameKeyAgain: K, set: Set<K>) => void, thisArg?: any): void {
        this._wrappedSet.forEach(callbackfn, thisArg);
    }

    public has(key: K): boolean {
        return this._wrappedSet.has(key);
    }

    public add(key: K): this {
        if (this.has(key)) {
            breakWhileDebugging();
            throw new Error(`Cannot add key ${key} because it already exists`);
        }

        return this.addOrReplaceIfExists(key);
    }

    public addOrReplaceIfExists(key: K): this {
        this._wrappedSet.add(key);
        return this;
    }

    [Symbol.iterator](): IterableIterator<K> {
        return this._wrappedSet[Symbol.iterator]();
    }

    public entries(): IterableIterator<[K, K]> {
        return this._wrappedSet.entries();
    }

    public keys(): IterableIterator<K> {
        return this._wrappedSet.keys();
    }

    public values(): IterableIterator<K> {
        return this._wrappedSet.values();
    }

    public toString(): string {
        return printSet('ValidatedSet', this);
    }

    public toArray(): K[] {
        return Array.from(this);
    }
}