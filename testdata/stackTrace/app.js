function buttonClick() {
    setTimeout(inner, 100);
}

function inner() {
    (function() {
        console.log('Inside anonymous function'); // bpLabel: stackTraceBreakpoint
    })();
}