function throwCaught() {
    try { throw new Error('Caught exception') } catch (e) {}
}

function throwUncaught() {
    var e = new Error('Uncaught exception');
    (<any>e).code = 123;
    throw e;
}
