export class Env {
    static get(varName: string, defaultValue?: string): string {
        const value = process.env[varName] ?? defaultValue;

        if (value === undefined) {
            throw new Error(`Переменная окружения ${varName} не задана`);
        }

        return value;
    }

    static get isDevelopment(): boolean {
        return this.get('NODE_ENV') === 'development';
    }

    static get isProduction(): boolean {
        return this.get('NODE_ENV') === 'production';
    }

    static get port(): number {
        const port = Number(this.get('PORT', '3000'));
        if (isNaN(port)) {
            throw new Error('Порт должен представлять число');
        }

        return port;
    }
}