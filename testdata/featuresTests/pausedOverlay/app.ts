function runCode() {
    console.log(`Before debugger; statement`);
    debugger;
    console.log(`After debugger; statement`);
}

runCode();