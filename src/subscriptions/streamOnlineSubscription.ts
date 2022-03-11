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
            handler: async (data) => {
                if (data.type !== 'live') return;

                const subscription = await this._app.notificationSubscriptionsRepository.findWithInternalCondition({
                    eventType: this.eventType,
                    internalCondition: data.broadcasterUser.id,
                    observer: this._observer.type
                });

                if (subscription === null) return;

                if (subscription.inputCondition !== data.broadcasterUser.name) {
                    this._app.notificationSubscriptionsRepository.updateInputCondition(subscription._id, data.broadcasterUser.name);
                }

                let subscribersCount = 0;

                this._app.bots.forEach(async (bot) => {
                    const addresses = await bot.subscribersRepository.listAddresses(subscription._id);
                    addresses.forEach((address) => {
                        subscribersCount++;
                        bot.sendMessage(address, `🔴 ${data.broadcasterUser.name} теперь онлайн!`);
                    });
                });

                if (subscribersCount === 0) {
                    await this._observer.unsubscribe(subscription._id);
                    await this._app.notificationSubscriptionsRepository.remove(subscription._id);
                }
            }
        });
    }
}