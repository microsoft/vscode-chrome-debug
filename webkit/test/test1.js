function printHello() {
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
    var obj = { a: 2 };
    xyz++;
    xyz++;
    console.log(str + obj.a);
    fn();
}

function anotherFn() {
    var zzzz = 1;
}