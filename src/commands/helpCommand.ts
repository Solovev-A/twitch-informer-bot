import { CommandParams } from "../types";
import { CommandBase } from "./commandBase";


export class HelpCommand extends CommandBase {
    readonly name = 'help';
    readonly description = 'Выводит список доступных команд';

    async execute({ bot, sender }: CommandParams): Promise<void> {
        const message = [...this._app.commandsByName.values()]
            .map(({ name, description }) => {
                if (name === this.name || name === 'start') return undefined;

                return `${bot.commandPrefix}${name} - ${description}`;
            })
            .filter(s => s)
            .join('\n');

        return await bot.sendMessage(sender, message);
    }
}