function buttonClick() {
    setTimeout(timeoutCallback, 100);
}

function timeoutCallback() {
    eval("evalCallback();");
}

function evalCallback() {
    (function() {
        console.log('Test stack trace here');
    })();
}