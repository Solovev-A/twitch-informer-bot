export interface App {
    start(): Promise<void>
}

export type EventTypeBase = string;

export interface EventObserver<TEvent extends EventTypeBase> {
    start(): Promise<void>
    subscribe(event: TEvent): Promise<void>;
    unsubscribe(eventId: string): Promise<void>;
}

export interface EventSubscription<TEvent extends EventTypeBase> {
    eventType: TEvent;
    start(): Promise<void>;
}

export interface EventSubscriptionConfig<TObserver extends EventObserver<TEvent>, TEvent extends EventTypeBase> {
    eventType: TEvent;
    observer: TObserver;
    app: App;
}