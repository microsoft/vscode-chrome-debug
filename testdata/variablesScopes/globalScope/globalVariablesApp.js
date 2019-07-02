console.log('TestCode: START');

debugger; // Pause here to get a list of all the "existing" global variables, so we know to ignore those

console.log('TestCode: BEFORE-ADDING-VARIABLES');

// Try to create a variable of each important type, to verify that we can see their contents properly

eval(`
var globalCode = 'page loaded';

function consoleDotLog(m) {
    console.log(m)
}

var manyPropsObj = { prop2: 'abc', prop1: 'def' };
for (var i = 0; i <= 100; i++) manyPropsObj[i] = 2 * i + 1;

var r = /^asdf.*$/g;
var longStr = \`this is a
string with
newlines\`;
var element = document.createElement("p");
var buffer = new ArrayBuffer(8);
var buffView = new Int32Array(buffer);
buffView[0] = 234;
var s = Symbol('hi');
var e = new Error('hi');

var m = new Map();
m.set('a', 1);

var b = document.body;
var nan = NaN;
var inf = 1 / 0;
var infStr = "Infinity";

eval('var evalVar3 = [1,2,3]');
eval('var evalVar1 = 16');
eval('var evalVar2 = "sdlfk"');

var bool = true;
var fn = () => {
    // Some fn
    var xyz = 321;
    anotherFn();
};
var fn2 = function () {
    var zzz = 333;
};
var qqq;
var str = 'hello';
var xyz = 1;
var obj = { a: 2, get thing() { throw 'xyz'; }, set thing(x) { } };
xyz++; xyz++; xyz++;

var myVar = {
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
`);

console.log('TestCode: BEFORE-VERIFYING-VARIABLES');

debugger; // Pause here to verify that we can see the values and types of all the variables

console.log('TestCode: END');
