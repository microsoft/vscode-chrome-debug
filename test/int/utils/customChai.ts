/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

/** We want to experiment with disabling the assertions of the wizards, to see if it makes it easier to port the tests to V1
 * This module provides a custom expect function that let us do that
 */

import * as chai from 'chai';
import { isThisV1 } from '../testSetup';

class NoopProxyHandler {
    get<T, K extends keyof T>(_target: T, _propertyKey: K, _receiver: any): any {
        return noopProxy;
    }

    construct(_target: any, _args: any): any {
        return noopProxy;
    }

    apply(_target: any, _that: any, _args: any): any {
        return noopProxy;
    }
}

function noopFunction() {
    return noopProxy;
}

const noopProxyHandler = new NoopProxyHandler();
const noopProxy = new Proxy<any>(noopFunction, noopProxyHandler);

function customExpect(target: any, message?: string): any {
    if (shouldBeNoop(target, message)) {
        return noopProxy;
    } else {
        return chai.expect(target, message);
    }
}

function defaultShouldBeNoop(_target: any, _message?: string): boolean {
    return isThisV1;
}

export let shouldBeNoop = defaultShouldBeNoop;

export const expect = customExpect;
