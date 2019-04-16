/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

export interface IEquivalenceComparable {
    isEquivalentTo(right: this): boolean;
}