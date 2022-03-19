import { EventObserver, EventSubscription, EventTypeBase, App, EventSubscriptionConstructor, SubscribeResult, EventDataBase } from "../types";


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

    abstract start(): Promise<void>
    abstract subscribe(event: TEvent): Promise<SubscribeResult>
    abstract unsubscribe(subscriptionId: string): Promise<void>
    abstract reset(): Promise<void>
}