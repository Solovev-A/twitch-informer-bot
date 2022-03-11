import { CommandParams } from "../types";
import { CommandBase } from "./commandBase";
import { MessageFormatter as Format } from "../utils/messageFormatter";


export class AddCommand extends CommandBase {
    readonly name = 'add';
    readonly description = 'Добавляет подписку на оповщение о событии';

    async execute({ bot, sender, rawArgs }: CommandParams): Promise<void> {
        const [observer, eventType, ...condition] = rawArgs.trim().split(/\s+/);

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

        let notificationSubscription = await this._app.notificationSubscriptionsRepository.findWithInputCondition({
            eventType,
            observer,
            inputCondition: condition.join(' ')
        });

        if (notificationSubscription === null) {
            try {
                notificationSubscription = await eventSubscription.start(condition);
            } catch (error) {
                return await bot.sendMessage(sender, Format.error(`${error}`));
            }
        }

        const response = await bot.subscribersRepository.addSubscription(sender, notificationSubscription._id);
        if (response.errorMessage) {
            return await bot.sendMessage(sender, Format.error(response.errorMessage));
        }

        const message =
            `Подписка на оповещения ${notificationSubscription.eventType} 
             для ${notificationSubscription.inputCondition} добавлена`;
        return await bot.sendMessage(sender, Format.ok(message));
    }
}