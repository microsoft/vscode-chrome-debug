function locals() {
    var arr1 = [1, 2];


    arr1.forEach(x => {
        console.log(x);
    });
    var r = /^asdf.*$/g;
    var longStr = `this is a
string with
newlines`;
    var element = document.body;
    var buffer = new ArrayBuffer(8);
    var buffView = new Int32Array(buffer);
    buffView[0] = 234;
    var s = Symbol('hi');
    var e = new Error('hi');

    eval('var evalVar3 = [1,2,3]');
    eval('var evalVar1 = 16');
    eval('var evalVar2 = "sdlfk"');

    var bool = true;
    var fn = () => {
        // Some fn
        var xyz = 321;
        anotherFn();
    };
    var fn2 = function() {
        var zzz = 333;
    };
    var qqq;
    var str = 'hello';
    var xyz = 1;
    var obj = { a: 2, get thing() { throw 'xyz'; }, set thing(x) { } };
    xyz++;                     xyz++;
    anotherFn();
    fn();

    throwCaught();
    throwUncaught();
}

function loadScript() {
    var s = document.createElement('script');
    s.src = 'test2.js';
    document.head.appendChild(s);
}

function throwCaught() {
    try { throw new Error('Caught exception') } catch (e) {}
}

function throwUncaught() {
    var e = new Error('Uncaught exception');
    e.code = 123;
    throw e;
}

function evalDebugger() {
    eval('var x = 1; debugger;');
    eval('throwCaught()');
    eval('throwUncaught()');
}

function consoleAPIs() {
    console.log({ a: 1, b: 'asdf', c: { d: 4 } });
    console.log({ a: 1}, {b: 2});
    console.count('count label');
    console.count('count label');
    console.dir({ z: 5 });
    console.time('timing');
    console.group('my group');
    console.log('hello', 'world!');
    console.error('with formatter:  %s world!', 'hello');
    console.log('%d %i %f', -19, -32.5, -9.4);
    console.groupEnd();
    console.timeEnd('timing');
    console.trace();

    eval('console.trace()');
    (() => console.trace())();

    (<any>console).table([1, 2, 3]);
    console.assert(1 == 2, '1 is not 2');
}
