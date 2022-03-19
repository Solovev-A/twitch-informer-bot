import { ManageNotificationSubscriptionCommandBase, ManageSubscriptionConfig } from "./manageNotificationSubscriptionCommandBase";
import { MessageFormatter as Format } from "../utils/messageFormatter";


export class AddCommand extends ManageNotificationSubscriptionCommandBase {
    readonly name = 'add';
    readonly description = 'Добавляет подписку на оповщение о событии';

    protected async manageNotificationSubscription(config: ManageSubscriptionConfig): Promise<void> {
        const { bot, sender, inputCondition, eventSubscription } = config;
        let notificationSubscription = config.storedNotificationSubscription;

        const limitCheck = await bot.subscribersRepository.checkSubscriptionsLimit(sender);
        if (!limitCheck.result) {
            const message = Format.error(`Достигнут лимит подписок (${limitCheck.limit})`);
            return await bot.sendMessage(sender, message);
        }

        if (notificationSubscription === null) {
            try {
                notificationSubscription = await eventSubscription.start(inputCondition);
            } catch (error) {
                return await bot.sendMessage(sender, Format.error(`${error}`));
            }
        }

        const response = await bot.subscribersRepository.addSubscription(sender, notificationSubscription._id);
        if (response.errorMessage) {
            return await bot.sendMessage(sender, Format.error(response.errorMessage));
        }

        const message =
            `Подписка на оповещения ${notificationSubscription.eventType} ` +
            `для ${notificationSubscription.inputCondition} добавлена`;
        return await bot.sendMessage(sender, Format.ok(message));
    }
}