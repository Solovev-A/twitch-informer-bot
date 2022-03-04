import { EventObserver, EventSubscription, EventTypeBase, App, EventSubscriptionConstructor, SubscribeResult } from "../types";


export interface BaseObserverConfig<TEvent extends EventTypeBase> {
    app: App;
    subscriptions: EventSubscriptionConstructor<TEvent>[];
}


export abstract class BaseObserver<TEvent extends EventTypeBase> implements EventObserver<TEvent> {
    readonly eventSubscriptionByEventType: Map<string, EventSubscription<TEvent>>;

    constructor(config: BaseObserverConfig<TEvent>) {
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
}