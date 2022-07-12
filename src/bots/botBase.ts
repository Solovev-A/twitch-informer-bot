import { App, Bot, NotificationSubscribersRepository } from "../types";
import { MessageFormatter as Format } from "../utils/messageFormatter";


export abstract class BotBase implements Bot {
    protected readonly _app: App;
    protected readonly _clientsInProgress: Set<string>;

    abstract readonly commandPrefix: string;
    abstract sendMessage(destination: string, message: string): Promise<void>
    abstract subscribersRepository: NotificationSubscribersRepository;

    constructor(app: App) {
        this._app = app;
        this._clientsInProgress = new Set();
    }

    abstract configure(): Promise<void>;

    protected async _onMessage(sender: string, message: string): Promise<void> {
        if (!message.startsWith(this.commandPrefix)) return;

        const [commandName, ...args] = message.substring(this.commandPrefix.length)
            .trim()
            .split(/\s+/);
        const command = this._app.commandsByName.get(commandName);

        if (command === undefined) {
            const message =
                `Нет такой команды <${commandName}>. Чтобы ознакомиться со списком доступных комманд, введите ${this.commandPrefix}help`;
            return await this.sendMessage(sender, Format.error(message));
        }


        try {
            if (this._clientsInProgress.has(sender)) {
                const message = `Дождитесь обработки предыдущей команды и повторите попытку`;
                return await this.sendMessage(sender, Format.error(message));
            }

            this._clientsInProgress.add(sender);
            await command.execute({
                sender,
                bot: this,
                rawArgs: args
            });
        } catch (error) {
            const message = `Во время исполнения команды произошла непредвиденная ошибка!
            Команда: ${commandName}, аргументы: ${args}\n`
            console.log(message, error);
        } finally {
            this._clientsInProgress.delete(sender);
        }
    }
}