import mongoose from 'mongoose';
import express, { Express } from 'express';

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
    protected _productionServer?: Express;

    get productionServer(): Express {
        if (this._productionServer === undefined) {
            throw new Error(`productionServer предназначен для режима "production", сейчас NODE_ENV == "${process.env.NODE_ENV}"`);
        }

        return this._productionServer;
    }

    private constructor(config: InformerAppConfig) {
        if (process.env.NODE_ENV === 'production') {
            this._productionServer = express();
        }
        this.observerByType = new Map();
        this.commandsByName = new Map(
            config.commands.map(CommandClass => {
                const command = new CommandClass(this);
                return [command.name, command];
            })
        );
        this.commandRule = config.commandRule ?? new DefaultCommandRule();
        this.bots = config.bots.map(BotClass => new BotClass(this));
        this.notificationSubscriptionsRepository = new MongodbNotificationSubscriptionsRepository();
    }

    static async create(config: InformerAppConfig): Promise<App> {
        const app = new InformerApp(config);

        await Promise.all(
            config.observers.map(async conf => {
                const observer = new conf.type({
                    app,
                    subscriptions: conf.subscriptions
                });
                await observer.configure();
                app.observerByType.set(observer.type, observer);
            })
        );

        return app;
    }

    async start(): Promise<void> {
        try {
            await mongoose.connect(process.env.DATABASE_CONNECTION_STRING!);

            if (process.env.NODE_ENV === 'development') {
                await this._reset();
                await this._startObserversAndBots();
            } else if (process.env.NODE_ENV === 'production') {
                this.productionServer.listen(Number(process.env.PORT), async () => {
                    await this._startObserversAndBots();
                });
            }
        } catch (error) {
            console.log(`Произошла непредвиденная ошибка!`, error);
        }
    }

    protected async _reset(): Promise<void> {
        [...this.observerByType.values()].forEach(async observer => {
            await observer.reset();
        });
        await this.notificationSubscriptionsRepository.clear();
        this.bots.forEach(async bot => {
            await bot.subscribersRepository.clear();
        });
    }

    protected async _startObserversAndBots() {
        await this._startObservers();
        await this._resumeStoredNotificationSubscriptions();
        await this._configureBots();
    }

    private async _startObservers(): Promise<void> {
        await Promise.all(
            [...this.observerByType.values()].map(async (observer) => await observer.start())
        );
    }

    private async _resumeStoredNotificationSubscriptions(): Promise<void> {
        const storedSubscriptions = await this.notificationSubscriptionsRepository.listAllSubscriptions();

        await Promise.all(
            storedSubscriptions.map(async sub => {
                const observer = this.observerByType.get(sub.observer)!;
                const eventSubscription = observer.eventSubscriptionByEventType.get(sub.eventType)!;
                try {
                    return await eventSubscription.resume(sub.inputCondition, sub.internalCondition);
                } catch (error) {
                    const message = `При возобновлении подписки произошла ошибка.
                    Подписка: ${sub}\n`;
                    console.log(message, error);
                }
            })
        );
    }

    private async _configureBots() {
        await Promise.all(
            this.bots.map(bot => bot.configure())
        );
    }
}