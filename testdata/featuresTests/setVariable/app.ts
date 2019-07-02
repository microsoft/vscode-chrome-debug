function runUntilExitIsSet() {
    let shouldExit = false;
    console.log(`Before shouldExit = ${shouldExit}`);
    console.log('Change shouldExit value here');
    console.log(`After shouldExit = ${shouldExit}`);
    if (!shouldExit) {
        setTimeout(runUntilExitIsSet, 100);
    } else {
        exitSuccesfully();
    }
}

function exitSuccesfully() {
    console.log('We exited the previous function');
}

runUntilExitIsSet();