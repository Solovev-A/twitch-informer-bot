import { App, EventDataBase, EventObserver, EventSubscription, EventSubscriptionConfig, EventTypeBase, NotificationSubscription, SubscribeResult } from "../types";

export abstract class SubscriptionBase<TEventData extends EventDataBase, TEvent extends EventTypeBase<TEventData>> implements EventSubscription<TEventData, TEvent> {
    protected readonly _app: App;
    protected readonly _observer: EventObserver<TEventData, EventTypeBase<TEventData>>;

    abstract readonly eventType: TEvent['eventType'];

    constructor(config: EventSubscriptionConfig<TEventData, EventTypeBase<TEventData>>) {
        this._app = config.app;
        this._observer = config.observer;
    }

    protected abstract _validateInputCondition(inputCondition: string): Promise<void>;
    protected abstract _getEventCondition(inputCondition: string, internalCondition?: any): TEvent['condition'];
    protected abstract _getActualInputCondition(eventData: TEventData): string;
    protected abstract _getMessage(eventData: TEventData): string;
    protected abstract _getNewEventState(eventData: TEventData): any | undefined;

    async start(inputCondition: string): Promise<NotificationSubscription> {
        await this._validateInputCondition(inputCondition);
        const subscribeResult = await this._subscribe(inputCondition);

        return await this._app.notificationSubscriptionsRepository.create({
            _id: subscribeResult.subscriptionId,
            internalCondition: subscribeResult.internalCondition,
            state: subscribeResult.initialState,
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

        const event: EventTypeBase<TEventData> = {
            eventType: this.eventType,
            condition: eventCondition,
            handler: async (data: TEventData) => {
                const { subscription } = data;

                const actualInputCondition = this._getActualInputCondition(data);
                if (subscription.inputCondition !== actualInputCondition) {
                    this._app.notificationSubscriptionsRepository.updateInputCondition(subscription._id, actualInputCondition);
                }

                let subscribersCount = 0;

                await Promise.all(this._app.bots.map(async (bot) => {
                    const addresses = await bot.subscribersRepository.listAddresses(subscription._id);
                    subscribersCount += addresses.length;
                    const message = this._getMessage(data);
                    addresses.forEach((address) => {
                        bot.sendMessage(address, message);
                    });
                }));

                if (subscribersCount === 0) {
                    await this._observer.unsubscribe(subscription._id);
                    await this._app.notificationSubscriptionsRepository.remove(subscription._id);
                    return;
                }

                const newState = this._getNewEventState(data);
                if (newState === undefined) return;

                await this._app.notificationSubscriptionsRepository.updateState(subscription._id, newState);
            }
        };

        return await this._observer.subscribe(event);
    }
}