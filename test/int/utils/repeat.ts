export async function asyncRepeatSerially(howManyTimes: number, action: () => Promise<void>): Promise<void> {
    for (let index = 0; index < howManyTimes; ++index) {
        await action();
    }
}
