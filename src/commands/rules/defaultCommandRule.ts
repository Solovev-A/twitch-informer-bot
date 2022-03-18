import { CommandRule } from "../../types";


export class DefaultCommandRule implements CommandRule {
    template = 'add <платформа> <событие> <условие>';
    example = 'add twitch live sgtgrafoyni';

    parse(rawArgs: string[]) {
        const [observer, eventType, ...condition] = rawArgs;
        const inputCondition = condition.join(' ');

        return {
            observer: observer.toLowerCase(),
            eventType: eventType.toLowerCase(),
            inputCondition: inputCondition.toLowerCase()
        }
    }
}