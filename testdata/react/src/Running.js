
// a script to keep running forever

let num = 0;
export function runForever() {
    setTimeout(() => {
        num++;
        runForever();
    }, 50);
}