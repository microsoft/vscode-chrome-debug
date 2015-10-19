function doEcho(message: string) {
    postMessage(message);
}

function handleMessage(message: string) {
    doEcho(message);
    if (message == 'error!') {
        throw 'Error on purpose!';
    } else if (message == 'debugger') {
        debugger;
    }
}

addEventListener('message', e => {
    handleMessage(e.data);
}, false);

importScripts('worker2.js');