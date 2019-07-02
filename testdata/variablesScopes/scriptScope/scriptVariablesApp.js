console.log('TestCode: START');
console.log('TestCode: BEFORE-ADDING-VARIABLES');

// Try to create a variable of each important type, to verify that we can see their contents properly

const globalCode = 'page loaded';

function consoleDotLog(m) {
    console.log(m)
}

const manyPropsObj = { prop2: 'abc', prop1: 'def' };
for (let i = 0; i <= 100; i++) manyPropsObj[i] = 2 * i + 1;

let r = /^asdf.*$/g;
let longStr = `this is a
string with
newlines`;
let element = document.body;
const buffer = new ArrayBuffer(8);
let buffView = new Int32Array(buffer);
buffView[0] = 234;
let s = Symbol('hi');
let e = new Error('hi');

let m = new Map();
m.set('a', 1);

let b = document.body;
const nan = NaN;
let inf = 1 / 0;
let infStr = "Infinity";

// These 3 are going to be global variables
eval('let evalVar3 = [1,2,3]');
eval('let evalVar1 = 16');
eval('let evalVar2 = "sdlfk"');

let bool = true;
const fn = () => {
    // Some fn
    let xyz = 321;
    anotherFn();
};
let fn2 = function () {
    let zzz = 333;
};
let qqq;
let str = 'hello';
let xyz = 1;
let obj = { a: 2, get thing() { throw 'xyz'; }, set thing(x) { } };
xyz++; xyz++; xyz++;

let myVar = {
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

myVar["self"] = myVar;
myVar.obj["toMyVar"] = myVar;


console.log('TestCode: BEFORE-VERIFYING-VARIABLES');

debugger; // Pause here to verify that we can see the values and types of all the variables

console.log('TestCode: END');
