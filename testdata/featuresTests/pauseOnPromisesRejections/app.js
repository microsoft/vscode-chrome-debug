async function doAsyncProcessing() {
    return new Promise((resolve, reject) => {
        reject(`Things didn't go as expected`);
    });
}

doAsyncProcessing();