export class MessageFormatter {
    static error(message: string): string {
        return `🚫 ${message}`
    }

    static ok(message: string): string {
        return `✔️ ${message}`
    }

    static recommend(message: string): string {
        return `➡️ ${message}`
    }
}