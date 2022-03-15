import { CommandParams, NotificationSubscription } from "../types";
import { CommandBase } from "./commandBase";


export class ListCommand extends CommandBase {
    readonly name = 'list';
    readonly description = 'Предоставляет список активных подписок';

    async execute({ bot, sender }: CommandParams): Promise<void> {
        const notificationSubscriptions = await bot.subscribersRepository.listSubscriptions(sender);

        if (notificationSubscriptions.length === 0) {
            return await bot.sendMessage(sender, 'Ваш список подписок пуст');
        }

        const subscriptionsByObserver = groupBy(notificationSubscriptions, s => s.observer);
        const message = Object.entries(subscriptionsByObserver)
            .map(([observer, items]) => observerNotificationSubscriptionsToString(observer, items))
            .join('==========\n');

        return await bot.sendMessage(sender, message);
    }
}


function groupBy<T, K extends keyof any>(items: T[], keySelector: (item: T) => K) {
    return items.reduce(
        (result, item) => ({
            ...result,
            [keySelector(item)]: [
                ...(result[keySelector(item)] ?? []),
                item
            ],
        }),
        {} as Record<K, T[]>
    );
}

function observerNotificationSubscriptionsToString(observer: string, items: NotificationSubscription[]): string {
    const subscriptionsByEventType = groupBy(items, i => i.eventType);
    let result = `${observer}:\n`;

    Object.entries(subscriptionsByEventType).forEach(([eventType, subscriptions]) => {
        result += `\t${eventType}:\n`;

        subscriptions.forEach(s => {
            result += `\t- ${s.inputCondition}\n`
        })
    });

    return result;
}