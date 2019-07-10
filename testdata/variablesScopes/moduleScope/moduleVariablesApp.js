console.log('TestCode: START');
console.log('TestCode: BEFORE-ADDING-VARIABLES');
// Try to create a variable of each important type, to verify that we can see their contents properly
export const globalCode = 'page loaded';
function consoleDotLog(m2) {
    console.log(m2);
}
export const manyPropsObj = { prop2: 'abc', prop1: 'def' };
for (let i = 0; i <= 100; i++)
    manyPropsObj[i] = 2 * i + 1;
export let r = /^asdf.*$/g;
export let longStr = `this is a
string with
newlines`;
export let element = document.body;
export const buffer = new ArrayBuffer(8);
export let buffView = new Int32Array(buffer);
buffView[0] = 234;
export let s = Symbol('hi');
export let e = new Error('hi');
export let m = new Map();
m.set('a', 1);
export let b = document.body;
export const nan = NaN;
export let inf = 1 / 0;
export let infStr = 'Infinity';
export let bool = true;
export const fn = () => {
    // Some fn
    let xyzz = 321;
    fn2(xyzz);
};
export let fn2 = function (param) {
    let zzz = 333;
    return param + zzz;
};
export let qqq;
export let str = 'hello';
export let xyz = 1;
export let obj = { a: 2, get thing() { throw 'xyz'; }, set thing(x) { } };
xyz++;
xyz++;
xyz++;
export let myVar = {
    num: 1,
    str: 'Global',
    obj: {
        obj: {
            obj: { num: 10 },
            obj2: { obj3: {} },
        }
    },
    obj2: {
        obj3: {}
    },
};
myVar['self'] = myVar;
myVar.obj['toMyVar'] = myVar;
console.log('TestCode: BEFORE-VERIFYING-VARIABLES');
// tslint:disable-next-line: no-debugger
debugger; // Pause here to verify that we can see the values and types of all the variables
console.log('TestCode: END');
