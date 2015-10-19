var worker: Worker;
function startWorker() {
    worker = new Worker('worker.js');
    worker.onmessage = function(e) {
        console.log(e.data);
    };
    worker.postMessage('echo worker started');
}

function sendWorkerMessage() {
    worker.postMessage('debugger');
}

function killWorker() {
    worker.terminate();
}
