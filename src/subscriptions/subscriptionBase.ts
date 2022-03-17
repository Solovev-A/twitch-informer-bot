import { App, EventObserver, EventSubscription, EventSubscriptionConfig, EventTypeBase, NotificationSubscription, SubscribeResult } from "../types";

type EventData<TEvent extends EventTypeBase> = Parameters<TEvent['handler']>;

export abstract class SubscriptionBase<TEvent extends EventTypeBase> implements EventSubscription<TEvent> {
    protected readonly _app: App;
    protected readonly _observer: EventObserver<EventTypeBase>;

    abstract readonly eventType: TEvent['eventType'];

    constructor(config: EventSubscriptionConfig<EventTypeBase>) {
        this._app = config.app;
        this._observer = config.observer;
    }

    protected abstract _validateInputCondition(inputCondition: string): Promise<void>;
    protected abstract _getEventCondition(inputCondition: string, internalCondition?: any): TEvent['condition'];
    protected abstract _getInternalCondition(...eventData: EventData<TEvent>): any;
    protected abstract _getActualInputCondition(...eventData: EventData<TEvent>): string;
    protected abstract _getMessage(...eventData: EventData<TEvent>): string;

    async start(inputCondition: string): Promise<NotificationSubscription> {
        await this._validateInputCondition(inputCondition);
        const subscribeResult = await this._subscribe(inputCondition);

        return await this._app.notificationSubscriptionsRepository.create({
            _id: subscribeResult.subscriptionId,
            internalCondition: subscribeResult.internalCondition,
            eventType: this.eventType,
            observer: this._observer.type,
            inputCondition
        });
    }

    async resume(inputCondition: string, internalCondition: any): Promise<void> {
        await this._subscribe(inputCondition, internalCondition);
    }

    protected async _subscribe(inputCondition: string, internalCondition?: any): Promise<SubscribeResult> {
        const eventCondition = this._getEventCondition(inputCondition, internalCondition);

        const event: EventTypeBase = {
            eventType: this.eventType,
            condition: eventCondition,
            handler: async (data: EventData<TEvent>) => {
                const subscription = await this._app.notificationSubscriptionsRepository.findWithInternalCondition({
                    eventType: this.eventType,
                    internalCondition: this._getInternalCondition(...data),
                    observer: this._observer.type
                });

                if (subscription === null) return;

                const actualInputCondition = this._getActualInputCondition(...data);
                if (subscription.inputCondition !== actualInputCondition) {
                    this._app.notificationSubscriptionsRepository.updateInputCondition(subscription._id, actualInputCondition);
                }

                let subscribersCount = 0;

                this._app.bots.forEach(async (bot) => {
                    const addresses = await bot.subscribersRepository.listAddresses(subscription._id);
                    const message = this._getMessage(...data);
                    addresses.forEach((address) => {
                        subscribersCount++;
                        bot.sendMessage(address, message);
                    });
                });

                if (subscribersCount === 0) {
                    await this._observer.unsubscribe(subscription._id);
                    await this._app.notificationSubscriptionsRepository.remove(subscription._id);
                }
            }
        };

        return await this._observer.subscribe(event);
    }
}