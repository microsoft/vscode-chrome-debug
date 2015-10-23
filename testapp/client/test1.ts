function locals() {
    var arr1 = [1, 2, 3];



    arr1.forEach(x => {
        console.log(x);
    });
    var r = /^asdf.*$/g;
    var longStr = `this is a
string with
newlines`;
    var buffer = new ArrayBuffer(8);
    var buffView   = new Int32Array(buffer);
    buffView[0] = 234;
    var s = Symbol('hi');

    var bool = true;
    var fn = function() {
        // Some fn
        var xyz = 321;
        anotherFn();
    };
    var qqq;
    var str = 'hello';
    var xyz = 1;
    var obj = { a: 2, get thing() { throw 'xyz'; }, set thing(x) { } };
    xyz++;                     xyz++;
    console.log(str + obj.a);
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
}
