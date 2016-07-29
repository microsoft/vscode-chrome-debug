const globalCode = 'page loaded';
console.log(globalCode);

function locals() {
    const manyPropsObj: any = { prop2: 'abc', prop1: 'def' };
    for (let i=0; i<=100; i++) manyPropsObj[i] = Math.random();

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

    var m = new Map();
    m.set('a', 1);

    var b = document.body;
    let nan = NaN;
    let inf = 1/0;
    let infStr = "Infinity";

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
