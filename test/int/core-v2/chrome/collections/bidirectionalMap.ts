/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from 'assert';
import { ValidatedMap } from './validatedMap';
import { printMap } from './printing';
import { breakWhileDebugging } from '../../validation';

/** A map where we can efficiently get the key from the value or the value from the key */
export class BidirectionalMap<Left, Right> {
    private readonly _leftToRight = new ValidatedMap<Left, Right>();
    private readonly _rightToLeft = new ValidatedMap<Right, Left>();

    constructor(initialContents?: Iterable<[Left, Right]> | ReadonlyArray<[Left, Right]>) {
        this._leftToRight = initialContents ? new ValidatedMap<Left, Right>(initialContents) :  new ValidatedMap<Left, Right>();
        const reversed = Array.from(this._leftToRight.entries()).map(e => <[Right, Left]>[e[1], e[0]]);
        this._rightToLeft = new ValidatedMap<Right, Left>(reversed);
    }

    public clear(): void {
        this._leftToRight.clear();
        this._rightToLeft.clear();
    }

    public deleteByLeft(left: Left): boolean {
        const right = this._leftToRight.get(left);
        if (right !== undefined) {
            this.delete(left, right);
            return true;
        } else {
            return false;
        }
    }

    public deleteByRight(right: Right): boolean {
        const left = this._rightToLeft.get(right);
        if (left !== undefined) {
            this.delete(left, right);
            return true;
        } else {
            return false;
        }
    }

    private delete(left: Left, right: Right): void {
        assert.ok(this._leftToRight.delete(left), `Expected left (${left}) associated with right (${right}) to exist on the left to right internal map`);
        assert.ok(this._rightToLeft.delete(right), `Expected right (${right}) associated with left (${left}) to exist on the right to left internal map`);
    }

    public forEach(callbackfn: (Right: Right, left: Left, map: Map<Left, Right>) => void, thisArg?: any): void {
        return this._leftToRight.forEach(callbackfn, thisArg);
    }

    public getByLeft(left: Left): Right {
        return this._leftToRight.get(left);
    }

    public getByRight(right: Right): Left {
        return this._rightToLeft.get(right);
    }

    public tryGettingByLeft(left: Left): Right | undefined {
        return this._leftToRight.tryGetting(left);
    }

    public tryGettingByRight(right: Right): Left | undefined {
        return this._rightToLeft.tryGetting(right);
    }

    public hasLeft(left: Left): boolean {
        return this._leftToRight.has(left);
    }

    public hasRight(right: Right): boolean {
        return this._rightToLeft.has(right);
    }

    public set(left: Left, right: Right): this {
        const existingRightForLeft = this._leftToRight.tryGetting(left);
        const existingLeftForRight = this._rightToLeft.tryGetting(right);

        if (existingRightForLeft !== undefined) {
            breakWhileDebugging();
            throw new Error(`Can't set the pair left (${left}) and right (${right}) because there is already a right element (${existingRightForLeft}) associated with the left element`);
        }

        if (existingLeftForRight !== undefined) {
            breakWhileDebugging();
            throw new Error(`Can't set the pair left (${left}) and right (${right}) because there is already a left element (${existingLeftForRight}) associated with the right element`);
        }

        this._leftToRight.set(left, right);
        this._rightToLeft.set(right, left);
        return this;
    }

    public size(): number {
        return this._leftToRight.size;
    }

    public lefts(): IterableIterator<Left> {
        return this._leftToRight.keys();
    }

    public rights(): IterableIterator<Right> {
        return this._rightToLeft.keys();
    }

    public toString(): string {
        return printMap('BidirectionalMap', this._leftToRight);
    }
}