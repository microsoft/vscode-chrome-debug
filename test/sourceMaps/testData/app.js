/**
 * Test class A
 */
var A = (function () {
    function A(x) {
        this._x = 3;
        this._x = x;
    }
    A.prototype.method1 = function () {
        var x = this._x;
        x++;
        return x;
    };
    A.prototype.method2 = function () {
        return 'blah';
    };
    return A;
}());
function f() {
    var a = new A(4);
    console.log(a.method1());
}
f();
//# sourceMappingURL=app.js.map