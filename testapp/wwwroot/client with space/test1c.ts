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
