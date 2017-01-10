function f() {
    console.log('mapped');
}

setInterval(() => {
    callbackCaller(f);
}, 0);