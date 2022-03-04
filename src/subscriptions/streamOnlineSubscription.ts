import { EventSubscriptionConfig, App, EventObserver, EventSubscription, StreamOnlineEvent, SubscribeResult } from "../types";


type StreamOnlineSubscriptionCondition = {
    broadcasterUserName: string;
    broadcasterId?: string;
}

export class StreamOnlineSubscription implements EventSubscription<StreamOnlineEvent> {
    protected readonly _app: App;
    protected readonly _observer: EventObserver<StreamOnlineEvent>;

    readonly eventType: StreamOnlineEvent['eventType'];

    constructor(config: EventSubscriptionConfig<StreamOnlineEvent>) {
        this._app = config.app;
        this._observer = config.observer;
        this.eventType = 'stream-online';
    }

    async start(condition: StreamOnlineSubscriptionCondition): Promise<void> {
        const subscribeResult = await this._subscribe(condition);

        this._app.notificationSubscriptionsRepository.create({
            _id: subscribeResult.subscriptionId,
            internalCondition: subscribeResult.internalCondition,
            eventType: this.eventType,
            observer: this._observer.type,
            inputCondition: condition.broadcasterUserName,
        });
    }

    async resume(condition: StreamOnlineSubscriptionCondition) {
        await this._subscribe(condition);
    }

    protected async _subscribe({ broadcasterUserName, broadcasterId }: StreamOnlineSubscriptionCondition): Promise<SubscribeResult> {
        return await this._observer.subscribe({
            eventType: this.eventType,
            condition: {
                broadcasterUserName,
                broadcasterId
            },
            handler: (data) => {
                this._app.bots.forEach(async (bot) => {
                    if (data.type !== 'live') return;

                    const subscribers = await bot.subscribersRepository.listSubscribers({
                        eventType: this.eventType,
                        internalCondition: data.broadcasterUser.id,
                        observer: this._observer.type
                    });

                    subscribers.forEach((subscriber) => {
                        bot.sendMessage(subscriber.address, `🔴 ${data.broadcasterUser.name} теперь онлайн!`);
                    });
                });
            }
        });
    }
}