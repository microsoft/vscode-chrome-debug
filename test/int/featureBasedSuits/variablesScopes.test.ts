/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TestProjectSpec } from '../framework/frameworkTestSupport';
import { VariablesWizard } from '../wizards/variables/variablesWizard';
import { LaunchProject } from '../fixtures/launchProject';
import { testUsing } from '../fixtures/testUsing';

// Scopes' kinds: 'global' | 'local' | 'with' | 'closure' | 'catch' | 'block' | 'script' | 'eval' | 'module'
// TODO: Test several scopes at the same time. They can be repeated, and the order does matter
suite('Variables scopes', function () {
    testUsing('local', context => LaunchProject.create(context, TestProjectSpec.fromTestPath('variablesScopes/localScope')), async (launchProject) => {
        await launchProject.pausedWizard.waitUntilPausedOnDebuggerStatement();

        await new VariablesWizard(launchProject.debugClient).assertTopFrameVariablesAre({
            local: `
                this = Window (Object)
                arguments = Arguments(0) [] (Object)
                b = body {text: "", link: "", vLink: "", …} (Object)
                bool = true (boolean)
                buffer = ArrayBuffer(8) {} (Object)
                buffView = Int32Array(2) [234, 0] (Object)
                consoleDotLog = function consoleDotLog(m) { … } (Function)
                e = Error: hi (Object)
                element = body {text: "", link: "", vLink: "", …} (Object)
                fn = () => { … } (Function)
                fn2 = function () { … } (Function)
                globalCode = "page loaded" (string)
                inf = Infinity (number)
                infStr = "Infinity" (string)
                longStr = "this is a\nstring with\nnewlines" (string)
                m = Map(1) {} (Object)
                manyPropsObj = Object {0: 1, 1: 3, 2: 5, …} (Object)
                myVar = Object {num: 1, str: "Global", obj: Object, …} (Object)
                nan = NaN (number)
                obj = Object {a: 2, thing: <accessor>} (Object)
                qqq = undefined (undefined)
                r = /^asdf.*$/g {lastIndex: 0} (Object)
                s = Symbol(hi) (symbol)
                str = "hello" (string)
                xyz = 4 (number)`}
        );
    });
});
