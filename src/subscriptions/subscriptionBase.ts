import { App, EventDataBase, EventObserver, EventSubscription, EventSubscriptionConfig, EventTypeBase, NotificationSubscription, Response, SubscribeResult } from "../types";

export abstract class SubscriptionBase<TEventData extends EventDataBase, TEvent extends EventTypeBase<TEventData>> implements EventSubscription<TEventData, TEvent> {
    protected readonly _app: App;
    protected readonly _observer: EventObserver<TEventData, EventTypeBase<TEventData>>;

    abstract readonly eventType: TEvent['eventType'];

    constructor(config: EventSubscriptionConfig<TEventData, EventTypeBase<TEventData>>) {
        this._app = config.app;
        this._observer = config.observer;
    }

    protected abstract _validateInputCondition(inputCondition: string): Response<boolean>;
    protected abstract _getEventCondition(inputCondition: string, internalCondition?: any): TEvent['condition'];
    protected abstract _getActualInputCondition(eventData: TEventData): string;
    protected abstract _getMessage(eventData: TEventData): string;
    protected abstract _getNewEventState(eventData: TEventData): any | undefined;

    async start(inputCondition: string): Promise<Response<NotificationSubscription>> {
        const validationResponse = this._validateInputCondition(inputCondition);
        if (!validationResponse.result) {
            return { errorMessage: validationResponse.errorMessage }
        }

        const event = this._createEventObject(inputCondition);
        const subscribeResponse = await this._observer.subscribe(event);
        if (subscribeResponse.errorMessage || !subscribeResponse.result) {
            return { errorMessage: subscribeResponse.errorMessage }
        }

        const subscribeResult = subscribeResponse.result;

        try {
            return {
                result: await this._app.notificationSubscriptionsRepository.create({
                    _id: subscribeResult.subscriptionId,
                    internalCondition: subscribeResult.internalCondition,
                    state: subscribeResult.initialState,
                    eventType: this.eventType,
                    observer: this._observer.type,
                    inputCondition
                })
            }
        } catch (error) {
            return {
                errorMessage: 'Кажется, у нас что-то сломалось. Попробуйте повторить попытку позже'
            }
        }
    }

    async resume(inputCondition: string, internalCondition: any): Promise<void> {
        const event = this._createEventObject(inputCondition, internalCondition);
        await this._observer.resumeSubscription(event);
    }

    protected _createEventObject(inputCondition: string, internalCondition?: any): EventTypeBase<TEventData> {
        const eventCondition = this._getEventCondition(inputCondition, internalCondition);

        const event: EventTypeBase<TEventData> = {
            eventType: this.eventType,
            condition: eventCondition,
            handler: async (data: TEventData) => {
                const { subscription } = data;

                const actualInputCondition = this._getActualInputCondition(data).toLowerCase();
                if (subscription.inputCondition.toLowerCase() !== actualInputCondition) {
                    this._app.notificationSubscriptionsRepository.updateInputCondition(subscription._id, actualInputCondition);
                }

                let subscribersCount = 0;

                await Promise.all(this._app.bots.map(async (bot) => {
                    const addresses = await bot.subscribersRepository.listAddresses(subscription._id);
                    subscribersCount += addresses.length;
                    const message = this._getMessage(data);
                    addresses.forEach(async (address) => {
                        await bot.sendMessage(address, message);
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

        return event;
    }
}