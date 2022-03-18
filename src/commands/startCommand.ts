import { CommandParams } from "../types";
import { CommandBase } from "./commandBase";


export class StartCommand extends CommandBase {
    readonly name = 'start';
    readonly description = 'Отправляет приветствующее сообщение с рекомендацией по использованию';

    async execute({ bot, sender }: CommandParams): Promise<void> {
        const platforms = [...this._app.observerByType.keys()].join(', ');
        const message =
            `Привет! Этот бот поможет быть в курсе интересующих вас событий ${platforms}.\n` +
            'Чтобы начать, введите команду по шаблону:\n' +
            `${bot.commandPrefix}${this._app.commandRule.template}\n` +
            'Например:\n' +
            `${bot.commandPrefix}${this._app.commandRule.example}`;

        await bot.sendMessage(sender, message);
    }
}