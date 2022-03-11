import mongoose from 'mongoose';

import { App, EventTypeBase, EventObserver, EventSubscriptionConstructor, Bot, NotificationSubscriptionsRepository } from './types';
import { BaseObserverConfig } from './observers/baseObserver';
import { MongodbNotificationSubscriptionsRepository } from './db/mongodbNotificationSubscriptionsRepository';


export interface InformerObserverConfig<TEvent extends EventTypeBase> {
    type: new (config: BaseObserverConfig<TEvent>) => EventObserver<TEvent>;
    subscriptions: EventSubscriptionConstructor<TEvent>[];
}

interface InformerAppConfig {
    observers: InformerObserverConfig<any>[];
}

export class InformerApp implements App {
    readonly observerByType: Map<string, EventObserver<EventTypeBase>>;
    readonly bots: Bot[];
    readonly notificationSubscriptionsRepository: NotificationSubscriptionsRepository;

    constructor(config: InformerAppConfig) {
        this.observerByType = new Map(
            config.observers.map(conf => {
                const observer = new conf.type({
                    app: this,
                    subscriptions: conf.subscriptions
                });
                return [observer.type, observer];
            })
        );

        this.bots = []; // TODO получение ботов из конфигурации
        this.notificationSubscriptionsRepository = new MongodbNotificationSubscriptionsRepository();
    }

    async start(): Promise<void> {
        try {
            await mongoose.connect(process.env.DATABASE_CONNECTION_STRING!);
            await Promise.all(
                [...this.observerByType.values()].map(async (observer) => await observer.start())
            );
        } catch (error) {
            console.log(`Произошла непредвиденная ошибка!`, error);
        }
    }
}