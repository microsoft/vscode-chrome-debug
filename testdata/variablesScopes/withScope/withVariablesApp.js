(function () {
    console.log('TestCode: START');
    console.log('TestCode: BEFORE-ADDING-VARIABLES');

    // Try to create a variable of each important type, to verify that we can see their contents properly

    const locals = {};
    locals.globalCode = 'page loaded';

    locals.consoleDotLog = function (m) {
        console.log(m)
    }

    locals.manyPropsObj = { prop2: 'abc', prop1: 'def' };
    for (locals.i = 0; locals.i <= 100; locals.i++) locals.manyPropsObj[locals.i] = 2 * locals.i + 1;

    locals.r = /^asdf.*$/g;
    locals.longStr = `this is a
string with
newlines`;
    locals.element = document.body;
    locals.buffer = new ArrayBuffer(8);
    locals.buffView = new Int32Array(locals.buffer);
    locals.buffView[0] = 234;
    locals.s = Symbol('hi');
    locals.e = new Error('hi');

    locals.m = new Map();
    locals.m.set('a', 1);

    locals.b = document.body;
    locals.nan = NaN;
    locals.inf = 1 / 0;
    locals.infStr = "Infinity";

    // These 3 are going to be global variables
    eval('locals.evalVar3 = [1,2,3]');
    eval('locals.evalVar1 = 16');
    eval('locals.evalVar2 = "sdlfk"');

    locals.bool = true;
    locals.fn = () => {
        // Some fn
        locals.xyz = 321;
        anotherFn();
    };
    locals.fn2 = function () {
        locals.zzz = 333;
    };
    locals.qqq;
    locals.str = 'hello';
    locals.xyz = 1;
    locals.obj = { a: 2, get thing() { throw 'xyz'; }, set thing(x) { } };
    locals.xyz++; locals.xyz++; locals.xyz++;

    locals.myVar = {
        num: 1,
        str: "Global",

        obj: {
            obj: {
                obj: { num: 10 },
                obj2: { obj3: {} },
            }
        },
        obj2: {
            obj3: {}
        },

    }

    locals.myVar["self"] = locals.myVar;
    locals.myVar.obj["toMyVar"] = locals.myVar;

    console.log('TestCode: BEFORE-VERIFYING-VARIABLES');

    with (locals) {
        debugger; // Pause here to verify that we can see the values and types of all the variables
    }
    log('TestCode: END');
})();
