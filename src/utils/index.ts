export { MessageFormatter } from './messageFormatter';

export function delay(ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
    })
}