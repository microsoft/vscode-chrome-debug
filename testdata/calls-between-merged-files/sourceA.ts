function f() {
    console.log('mapped');
}

setInterval(() => {
    callbackCaller1(f);
}, 1000);