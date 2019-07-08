/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { IFixture } from './fixture';
import { asyncMap } from '../core-v2/chrome/collections/async';

/** Combine multiple fixtures into a single fixture, for easier management (e.g. you just need to call a single cleanUp method) */
export class MultipleFixtures implements IFixture {
    private readonly _fixtures: IFixture[];

    public constructor(...fixtures: IFixture[]) {
        this._fixtures = fixtures;
    }

    public async cleanUp(): Promise<void> {
        await asyncMap(this._fixtures, fixture => fixture.cleanUp());
    }
}
