export interface App {
    readonly observerByType: Map<string, EventObserver<EventTypeBase>>;
    start(): Promise<void>;
}

export interface EventTypeBase {
    eventType: string;
    condition: any;
    handler: (...args: any[]) => void;
}

export interface StreamOnlineEventData {
    broadcasterUser: {
        id: string;
        name: string;
    };
    type: string
}

export interface StreamOnlineEvent {
    eventType: 'stream-online';
    condition: string;
        handler: (data: StreamOnlineEventData) => void;
}

export interface EventObserver<TEvent extends EventTypeBase> {
    readonly eventSubscriptionByEventType: Map<string, EventSubscription<TEvent>>;
    readonly type: string;
    start(): Promise<void>;
    subscribe(event: TEvent): Promise<void>;
    unsubscribe(subscriptionId: string): Promise<void>;
}

export interface EventSubscription<TEvent extends EventTypeBase> {
    readonly eventType: TEvent['eventType'];
    start(): Promise<void>;
}

export interface EventSubscriptionConfig<TEvent extends EventTypeBase> {
    observer: EventObserver<TEvent>;
    app: App;
}

export type EventSubscriptionConstructor<TEvent extends EventTypeBase>
    = new (config: EventSubscriptionConfig<TEvent>) => EventSubscription<TEvent>;