/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { utils } from 'vscode-chrome-debug-core';

/**
 * The test normally run very fast, so it's difficult to see what actions they are taking in the browser.
 * We can use the HumanSlownessSimulator to artifically slow some classes like the puppeteer classes, so it's the actions
 * will be taken at a lower speed, and it'll be easier to see and understand what is happening
 */
export class HumanSlownessSimulator {
    public constructor(private readonly _slownessInMillisecondsValueGenerator: () => number = () => 500) { }

    public simulateSlowness(): Promise<void> {
        return utils.promiseTimeout(undefined, this._slownessInMillisecondsValueGenerator());
    }

    public wrap<T extends object>(object: T): T {
        return new HumanSpeedProxy(this, object).wrapped();
    }
}

export class HumanSpeedProxy<T extends object> {
    constructor(
        private readonly _humanSlownessSimulator: HumanSlownessSimulator,
        private readonly _objectToWrap: T) {
    }

    public wrapped(): T {
        const handler = {
            get: <K extends keyof T>(target: T, propertyKey: K, _receiver: any) => {
                this._humanSlownessSimulator.simulateSlowness();
                const originalPropertyValue = target[propertyKey];
                if (typeof originalPropertyValue === 'function') {
                    return (...args: any) => {
                        const result = originalPropertyValue.apply(target, args);
                        if (result && result.then) {
                            // Currently we only slow down async operations
                            return result.then(async (promiseResult: object) => {
                                await this._humanSlownessSimulator.simulateSlowness();
                                return typeof promiseResult === 'object'
                                    ? this._humanSlownessSimulator.wrap(promiseResult)
                                    : promiseResult;
                            }, (rejection: unknown) => {
                                return rejection;
                            });
                        }
                    };
                } else {
                    return originalPropertyValue;
                }
            }
        };

        return new Proxy<T>(this._objectToWrap, handler);
    }
}

const humanSlownessSimulator = new HumanSlownessSimulator();

const humanSlownessEnabeld = process.env.RUN_TESTS_SLOWLY === 'true';

export function slowToHumanLevel<T extends object>(object: T): T {
    return humanSlownessEnabeld
        ? humanSlownessSimulator.wrap(object)
        : object;
}
