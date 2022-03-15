import Bot from "node-telegram-bot-api";
import Queue from 'smart-request-balancer';

import { App, NotificationSubscribersRepository } from "../types";
import { BotBase } from "./botBase";
import { MongodbNotificationSubscribersRepository } from './../db/mongodbNotificationSubscribersRepository';
import { SubscriberSchema } from "../db/schemas/subscriberSchema";


class TelegramSubscriber extends SubscriberSchema { }

export class TelegramBot extends BotBase {
    protected readonly _bot;
    protected readonly _queue;

    commandPrefix = '/';
    subscribersRepository: NotificationSubscribersRepository;

    constructor(app: App) {
        super(app);
        this.subscribersRepository = new MongodbNotificationSubscribersRepository(TelegramSubscriber);
        this._bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!, { polling: true });
        this._queue = new Queue({
            rules: {
                individual: {
                    rate: 1,
                    limit: 1,
                    priority: 1,
                }
            },
            overall: {
                rate: 30,
                limit: 1,
                priority: 1
            }
        });

        this._bot.on('message', async ({ text, chat }) => {
            if (!text) return;

            const sender = String(chat.id);
            await this._onMessage(sender, text);
        })
    }

    async sendMessage(destination: string, message: string): Promise<void> {
        await this._queue.request(
            async (retry) => {
                try {
                    await this._bot.sendMessage(destination, message);
                } catch (error: any) {
                    if (error.response?.body?.error_code === 429) {
                        return retry(error.response.body.parameters.retry_after);
                    }
                    throw error;
                }
            },
            destination,
            'individual'
        );
    }
}