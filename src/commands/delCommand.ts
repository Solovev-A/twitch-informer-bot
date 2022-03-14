import { ManageNotificationSubscriptionCommandBase, ManageSubscriptionConfig } from "./manageNotificationSubscriptionCommandBase";
import { MessageFormatter as Format } from "../utils/messageFormatter";


export class DelCommand extends ManageNotificationSubscriptionCommandBase {
    readonly name = 'del';
    readonly description = 'Удаляет подписку на оповщение о событии';

    protected async manageNotificationSubscription(config: ManageSubscriptionConfig): Promise<void> {
        const { bot, sender, condition } = config;
        let notificationSubscription = config.storedNotificationSubscription;

        if (notificationSubscription === null) {
            const message = `У вас нет подписки на оповещения для ${condition.join(' ')}`;
            return await bot.sendMessage(sender, Format.error(message))
        }

        const response = await bot.subscribersRepository.removeSubscription(sender, notificationSubscription._id)
        if (response.errorMessage) {
            return await bot.sendMessage(sender, Format.error(response.errorMessage));
        }

        const message =
            `Подписка на оповещения ${notificationSubscription.eventType} 
             для ${notificationSubscription.inputCondition} удалена`;
        return await bot.sendMessage(sender, Format.ok(message));
    }
}