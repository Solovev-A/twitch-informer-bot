import { EventSubscriptionConfig, App, EventObserver, EventSubscription, StreamOnlineEvent } from "../types";


export class StreamOnlineSubscription implements EventSubscription<StreamOnlineEvent> {

    protected readonly _app: App;
    protected readonly _observer: EventObserver<StreamOnlineEvent>;

    readonly eventType: StreamOnlineEvent['eventType'];

    constructor(config: EventSubscriptionConfig<StreamOnlineEvent>) {
        this._app = config.app;
        this._observer = config.observer;
        this.eventType = 'stream-online';
    }

    async start(): Promise<void> {
        this._observer.subscribe({
            eventType: this.eventType,
            subscribeArgs: {
                userId: 'userName from repository',
                handler: async (data) => { /* обработать data */ }
            }
        });
    }
}