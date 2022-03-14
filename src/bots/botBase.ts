import { App, Bot, NotificationSubscribersRepository } from "../types";
import { MessageFormatter as Format } from "../utils/messageFormatter";


export abstract class BotBase implements Bot {
    protected readonly _app: App;

    abstract readonly commandPrefix: string;
    abstract sendMessage(destination: string, message: string): Promise<void>
    abstract subscribersRepository: NotificationSubscribersRepository;

    constructor(app: App) {
        this._app = app;
    }

    protected async _onMessage(sender: string, message: string): Promise<void> {
        if (!message.startsWith(this.commandPrefix)) return;

        const [commandName, ...args] = message.substring(this.commandPrefix.length)
            .trim()
            .split(/\s+/);
        const command = this._app.commandsByName.get(commandName);

        if (command === undefined) {
            const message =
                `Нет такой команды. Чтобы ознакомиться со списком доступных комманд, введите ${this.commandPrefix}help`;
            return await this.sendMessage(sender, Format.error(message));
        }

        return await command.execute({
            sender,
            bot: this,
            rawArgs: args
        });
    }
}