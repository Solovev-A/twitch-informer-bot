import mongoose from 'mongoose';

import { App, EventTypeBase, EventObserver, EventSubscriptionConstructor, Bot, NotificationSubscriptionsRepository, Command, EventDataBase, CommandRule } from './types';
import { BaseObserverConfig } from './observers/baseObserver';
import { MongodbNotificationSubscriptionsRepository } from './db/mongodbNotificationSubscriptionsRepository';
import { DefaultCommandRule } from './commands/rules';


export interface InformerObserverConfig<TEventData extends EventDataBase, TEvent extends EventTypeBase<TEventData>> {
    type: new (config: BaseObserverConfig<TEventData, TEvent>) => EventObserver<TEventData, TEvent>;
    subscriptions: EventSubscriptionConstructor<TEventData, TEvent>[];
}

interface InformerAppConfig {
    observers: InformerObserverConfig<any, any>[];
    bots: (new (app: App) => Bot)[];
    commands: (new (app: App) => Command)[];
    commandRule?: CommandRule
}

export class InformerApp implements App {
    readonly observerByType: Map<string, EventObserver<EventDataBase, EventTypeBase<EventDataBase>>>;
    readonly bots: Bot[];
    readonly commandsByName: Map<string, Command>;
    readonly notificationSubscriptionsRepository: NotificationSubscriptionsRepository;
    readonly commandRule: CommandRule;

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

        this.commandsByName = new Map(
            config.commands.map(CommandClass => {
                const command = new CommandClass(this);
                return [command.name, command];
            })
        )

        this.commandRule = config.commandRule ?? new DefaultCommandRule();

        this.bots = config.bots.map(BotClass => new BotClass(this));
        this.notificationSubscriptionsRepository = new MongodbNotificationSubscriptionsRepository();
    }

    async start(): Promise<void> {
        try {
            await mongoose.connect(process.env.DATABASE_CONNECTION_STRING!);
            await this._resetOnDevelopment();
            await this._startObservers();
            await this._resumeStoredNotificationSubscriptions();
        } catch (error) {
            console.log(`Произошла непредвиденная ошибка!`, error);
        }
    }

    protected async _resumeStoredNotificationSubscriptions(): Promise<void> {
        const storedSubscriptions = await this.notificationSubscriptionsRepository.listAllSubscriptions();

        await Promise.all(
            storedSubscriptions.map(sub => {
                const observer = this.observerByType.get(sub.observer)!;
                const eventSubscription = observer.eventSubscriptionByEventType.get(sub.eventType)!;
                try {
                    return eventSubscription.resume(sub.inputCondition, sub.internalCondition);
                } catch (e) {
                    console.log('При возобновлении подписки произошла ошибка');
                }
            })
        );
    }

    protected async _startObservers(): Promise<void> {
        await Promise.all(
            [...this.observerByType.values()].map(async (observer) => await observer.start())
        );
    }

    protected async _resetOnDevelopment(): Promise<void> {
        if (process.env.NODE_ENV !== 'development') return;

        [...this.observerByType.values()].forEach(async observer => {
            await observer.reset();
        });
        await this.notificationSubscriptionsRepository.clear();
        this.bots.forEach(async bot => {
            await bot.subscribersRepository.clear();
        });
    }
}