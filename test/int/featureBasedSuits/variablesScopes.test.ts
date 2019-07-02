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

    testUsing('globals', context => LaunchProject.create(context, TestProjectSpec.fromTestPath('variablesScopes/globalScope')), async (launchProject) => {
        await launchProject.pausedWizard.waitUntilPausedOnDebuggerStatement();

        await new VariablesWizard(launchProject.debugClient).assertNewGlobalVariariablesAre(async () => {
            await launchProject.pausedWizard.resume();
            await launchProject.pausedWizard.waitUntilPausedOnDebuggerStatement();
        },
            // The variables declared with const, and let aren't global variables so they won't appear here
            `
            b = body {text: "", link: "", vLink: "", …} (Object)
            bool = true (boolean)
            buffer = ArrayBuffer(8) {} (Object)
            buffView = Int32Array(2) [234, 0] (Object)
            consoleDotLog = function consoleDotLog(m) { … } (Function)
            e = Error: hi (Object)
            element = p {align: "", title: "", lang: "", …} (Object)
            evalVar1 = 16 (number)
            evalVar2 = "sdlfk" (string)
            evalVar3 = Array(3) [1, 2, 3] (Object)
            fn = () => { … } (Function)
            fn2 = function () { … } (Function)
            globalCode = "page loaded" (string)
            i = 101 (number)
            inf = Infinity (number)
            infStr = "Infinity" (string)
            longStr = "this is a\nstring with\nnewlines" (string)
            m = Map(1) {} (Object)
            manyPropsObj = Object {0: 1, 1: 3, 2: 5, …} (Object)
            myVar = Object {num: 1, str: "Global", obj: Object, …} (Object)
            nan = NaN (number)
            obj = Object {a: 2, thing: <accessor>} (Object)
            qqq = undefined (undefined)
            r = /^asdf.*$/g {lastIndex: 0} (Object) // TODO: This and other types seems wrong. Investigate
            s = Symbol(hi) (symbol)
            str = "hello" (string)
            xyz = 4 (number)`);
    });

    testUsing('script', context => LaunchProject.create(context, TestProjectSpec.fromTestPath('variablesScopes/scriptScope')), async (launchProject) => {
        await launchProject.pausedWizard.waitUntilPausedOnDebuggerStatement();

        await new VariablesWizard(launchProject.debugClient).assertTopFrameVariablesAre({
            script: `
                this = Window (Object)
                b = body {text: "", link: "", vLink: "", …} (Object)
                bool = true (boolean)
                buffer = ArrayBuffer(8) {} (Object)
                buffView = Int32Array(2) [234, 0] (Object)
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

    testUsing('block', context => LaunchProject.create(context, TestProjectSpec.fromTestPath('variablesScopes/blockScope')), async (launchProject) => {
        await launchProject.pausedWizard.waitUntilPausedOnDebuggerStatement();

        await new VariablesWizard(launchProject.debugClient).assertTopFrameVariablesAre(
            {
                block: `
                    this = Window (Object)
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
                    xyz = 4 (number)`
            }
        );
    });

    testUsing('catch', context => LaunchProject.create(context, TestProjectSpec.fromTestPath('variablesScopes/catchScope')), async (launchProject) => {
        await launchProject.pausedWizard.waitUntilPausedOnDebuggerStatement();

        await new VariablesWizard(launchProject.debugClient).assertTopFrameVariablesAre({
            catch: `
                exception = Error: Something went wrong (Object)`}
        );
    });

    testUsing('closure', context => LaunchProject.create(context, TestProjectSpec.fromTestPath('variablesScopes/closureScope')), async (launchProject) => {
        await launchProject.pausedWizard.waitUntilPausedOnDebuggerStatement();

        await new VariablesWizard(launchProject.debugClient).assertTopFrameVariablesAre({
            closure: `
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
                pauseInside = function pauseInside() { … } (Function)
                qqq = undefined (undefined)
                r = /^asdf.*$/g {lastIndex: 0} (Object)
                s = Symbol(hi) (symbol)
                str = "hello" (string)
                xyz = 4 (number)`}
        );
    });

    testUsing('eval', context => LaunchProject.create(context, TestProjectSpec.fromTestPath('variablesScopes/evalScope')), async (launchProject) => {
        await launchProject.pausedWizard.waitUntilPausedOnDebuggerStatement();

        await new VariablesWizard(launchProject.debugClient).assertTopFrameVariablesAre({
            eval: `
                this = Window (Object)
                b = body {text: "", link: "", vLink: "", …} (Object)
                bool = true (boolean)
                buffer = ArrayBuffer(8) {} (Object)
                buffView = Int32Array(2) [234, 0] (Object)
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

    testUsing('with', context => LaunchProject.create(context, TestProjectSpec.fromTestPath('variablesScopes/withScope')), async (launchProject) => {
        await launchProject.pausedWizard.waitUntilPausedOnDebuggerStatement();

        await new VariablesWizard(launchProject.debugClient).assertTopFrameVariablesAre({
            with: `
                this = Window (Object)
                b = body {text: "", link: "", vLink: "", …} (Object)
                bool = true (boolean)
                buffer = ArrayBuffer(8) {} (Object)
                buffView = Int32Array(2) [234, 0] (Object)
                consoleDotLog = function (m) { … } (Function)
                e = Error: hi (Object)
                element = body {text: "", link: "", vLink: "", …} (Object)
                evalVar1 = 16 (number)
                evalVar2 = "sdlfk" (string)
                evalVar3 = Array(3) [1, 2, 3] (Object)
                fn = () => { … } (Function)
                fn2 = function () { … } (Function)
                globalCode = "page loaded" (string)
                i = 101 (number)
                inf = Infinity (number)
                infStr = "Infinity" (string)
                longStr = "this is a
                string with
                newlines" (string)
                m = Map(1) {} (Object)
                manyPropsObj = Object {0: 1, 1: 3, 2: 5, …} (Object)
                myVar = Object {num: 1, str: "Global", obj: Object, …} (Object)
                nan = NaN (number)
                obj = Object {a: 2, thing: <accessor>} (Object)
                r = /^asdf.*$/g {lastIndex: 0} (Object)
                s = Symbol(hi) (symbol)
                str = "hello" (string)
                xyz = 4 (number)
                __proto__ = Object {constructor: , __defineGetter__: , __defineSetter__: , …} (Object)`
        });
    });

    testUsing('module', context => LaunchProject.create(context, TestProjectSpec.fromTestPath('variablesScopes/moduleScope')), async (launchProject) => {
        await launchProject.pausedWizard.waitUntilPausedOnDebuggerStatement();

        await new VariablesWizard(launchProject.debugClient).assertTopFrameVariablesAre({
            module: `
                this = undefined (undefined)
                b = body {text: "", link: "", vLink: "", …} (Object)
                bool = true (boolean)
                buffer = ArrayBuffer(8) {} (Object)
                buffView = Int32Array(2) [234, 0] (Object)
                consoleDotLog = function consoleDotLog(m2) { … } (Function)
                e = Error: hi (Object)
                element = body {text: "", link: "", vLink: "", …} (Object)
                fn = () => { … } (Function)
                fn2 = function (param) { … } (Function)
                globalCode = "page loaded" (string)
                inf = Infinity (number)
                infStr = "Infinity" (string)
                longStr = "this is a
                string with
                newlines" (string)
                m = Map(1) {} (Object)
                manyPropsObj = Object {0: 1, 1: 3, 2: 5, …} (Object)
                myVar = Object {num: 1, str: "Global", obj: Object, …} (Object)
                nan = NaN (number)
                obj = Object {a: 2, thing: <accessor>} (Object)
                qqq = undefined (undefined)
                r = /^asdf.*$/g {lastIndex: 0} (Object)
                s = Symbol(hi) (symbol)
                str = "hello" (string)
                xyz = 4 (number)`
        });
    });
});
