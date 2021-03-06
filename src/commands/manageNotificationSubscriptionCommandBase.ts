import { Bot, CommandParams, EventDataBase, EventSubscription, EventTypeBase, NotificationSubscription } from "../types";
import { CommandBase } from "./commandBase";
import { MessageFormatter as Format } from "../utils/messageFormatter";


export interface ManageSubscriptionConfig {
    bot: Bot;
    sender: string;
    inputCondition: string;
    storedNotificationSubscription: NotificationSubscription | null;
    eventSubscription: EventSubscription<EventDataBase, EventTypeBase<EventDataBase>>
}

export abstract class ManageNotificationSubscriptionCommandBase extends CommandBase {
    readonly abstract name: string;
    readonly abstract description: string;

    protected abstract manageNotificationSubscription(config: ManageSubscriptionConfig): Promise<void>

    async execute({ bot, sender, rawArgs }: CommandParams): Promise<void> {
        const { observer, eventType, inputCondition } = this._app.commandRule.parse(rawArgs);

        const eventObserver = this._app.observerByType.get(observer)!;
        if (eventObserver === undefined) {
            const platforms = [...this._app.observerByType.keys()].join(', ');
            const message =
                Format.error(`Неверное значение для платформы - ${observer}.\n`) +
                Format.recommend(`Доступно: ${platforms}`);

            return await bot.sendMessage(sender, message);
        }

        const eventSubscription = eventObserver.eventSubscriptionByEventType.get(eventType);
        if (eventSubscription === undefined) {
            const events = [...eventObserver.eventSubscriptionByEventType.keys()].join(', ');
            const message =
                Format.error(`Неверное значение для события - ${eventType}.\n`) +
                Format.recommend(`Доступно: ${events}`);

            return await bot.sendMessage(sender, message);
        }

        const notificationSubscription = await this._app.notificationSubscriptionsRepository.findWithInputCondition({
            eventType,
            observer,
            inputCondition
        });

        await this.manageNotificationSubscription({
            bot,
            sender,
            inputCondition,
            storedNotificationSubscription: notificationSubscription,
            eventSubscription
        });
    }
}