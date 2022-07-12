import { EventObserver, EventSubscription, EventTypeBase, App, EventSubscriptionConstructor, SubscribeResult, EventDataBase, Response } from "../types";


export interface BaseObserverConfig<TEventData extends EventDataBase, TEvent extends EventTypeBase<TEventData>> {
    app: App;
    subscriptions: EventSubscriptionConstructor<TEventData, TEvent>[];
}

export abstract class BaseObserver<TEventData extends EventDataBase, TEvent extends EventTypeBase<TEventData>> implements EventObserver<TEventData, TEvent> {
    protected readonly _app: App;

    readonly eventSubscriptionByEventType: Map<string, EventSubscription<TEventData, TEvent>>;

    constructor(config: BaseObserverConfig<TEventData, TEvent>) {
        this._app = config.app;
        this.eventSubscriptionByEventType = new Map(
            config.subscriptions.map(subscriptionType => {
                const subscription = new subscriptionType({
                    app: config.app,
                    observer: this
                });
                return [subscription.eventType, subscription]
            })
        );
    }

    abstract readonly type: string;

    abstract configure(): Promise<void>;
    abstract start(): Promise<void>;
    abstract subscribe(event: TEvent): Promise<Response<SubscribeResult>>;
    abstract resumeSubscription(event: TEvent): Promise<void>;
    abstract unsubscribe(subscriptionId: string): Promise<void>;
    abstract reset(): Promise<void>;

    protected async _handleRevocation(subscriptionId: string): Promise<void> {
        const notificationSubscription = await this._app.notificationSubscriptionsRepository.findById(subscriptionId);

        if (notificationSubscription === null) return;

        const { inputCondition, eventType } = notificationSubscription;
        this._app.notificationSubscriptionsRepository.remove(subscriptionId);

        this._app.bots.forEach(async bot => {
            const subscribers = await bot.subscribersRepository.listAddresses(subscriptionId);

            subscribers.forEach(address => {
                bot.subscribersRepository.removeSubscription(address, subscriptionId);
                bot.sendMessage(address, `😔 Подписка на оповещения ${eventType} для ${inputCondition} была отменена по запросу от ${this.type}`);
            })
        })
    }
}