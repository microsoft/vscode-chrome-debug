function runCode() {
    var lineToBeExecutedNumber = 2;
    console.log('line 1');
    ++lineToBeExecutedNumber;
    console.log('line 2');
    ++lineToBeExecutedNumber;
    console.log('line 3');
    ++lineToBeExecutedNumber;
    console.log('line 4');
    ++lineToBeExecutedNumber;
    console.log('line 5');
    ++lineToBeExecutedNumber;
    console.log('line 6');
    ++lineToBeExecutedNumber;
    console.log('line 7');
    ++lineToBeExecutedNumber;
    console.log('line 8');
    ++lineToBeExecutedNumber;
    console.log('line 9');
    ++lineToBeExecutedNumber;
    console.log("line 10: " + lineToBeExecutedNumber);
}
var runCodeButton = document.getElementById('runCode');
runCodeButton.addEventListener('click', runCode);
//# sourceMappingURL=app.js.map