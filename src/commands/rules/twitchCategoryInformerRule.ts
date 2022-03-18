import { CommandRule } from "../../types";


export class TwitchCategoryInformerRule implements CommandRule {
    template = 'add <условие> <live?>';
    example = 'add sgtgrafoyni';

    parse(rawArgs: string[]) {
        const observer = 'twitch',
            inputCondition = rawArgs[0] ?? '',
            eventType = rawArgs[1] ?? 'channel-update';

        return {
            observer,
            eventType: eventType.toLowerCase(),
            inputCondition: inputCondition.toLowerCase()
        }
    }
}