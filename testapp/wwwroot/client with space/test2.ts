/* tslint:disable */

declare function scriptTagFn();

function anotherFn(cb?) {
    cb && cb();
    var zzzz = scriptTagFn();
    return 2345;
}
