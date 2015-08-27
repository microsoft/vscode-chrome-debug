function printHello() {
    var arr1 = [1, 2, 3];
    var arr2 = new Array();
    arr2.push('array element');
    var buffer = new ArrayBuffer(8);
    var buffView   = new Int32Array(buffer);
    buffView[0] = 234;

    var n = null;
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
    xyz++;
    xyz++;
    console.log(str + obj.a);
    anotherFn();
    fn();
    eval("throw new Error('fail')");

    try { throwSomething() } catch (e) {}
    throwSomething();
}

function anotherFn() {
    var zzzz = 1;
    return 2345;
}

function throwSomething() {
    throw new Error('error!');
}