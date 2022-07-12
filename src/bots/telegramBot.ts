import TelegramBotApi from "node-telegram-bot-api";
import Queue from 'smart-request-balancer';

import { App, NotificationSubscribersRepository } from "../types";
import { BotBase } from "./botBase";
import { MongodbNotificationSubscribersRepository } from './../db/mongodbNotificationSubscribersRepository';
import { SubscriberSchema } from "../db/schemas/subscriberSchema";
import { parseExpressRequestBody } from "../utils/parseExpressRequestBody";


class TelegramSubscriber extends SubscriberSchema { }

export class TelegramBot extends BotBase {
    protected readonly _bot;
    protected readonly _queue;

    commandPrefix = '/';
    subscribersRepository: NotificationSubscribersRepository;

    constructor(app: App) {
        super(app);
        this.subscribersRepository = new MongodbNotificationSubscribersRepository(TelegramSubscriber);
        this._bot = new TelegramBotApi(process.env.TELEGRAM_BOT_TOKEN!);

        if (process.env.NODE_ENV === 'production') {
            app.productionServer.post(`/${process.env.TELEGRAM_BOT_SECRET}`, async (req, res) => {
                try {
                    const body = await parseExpressRequestBody(req);
                    if (body.update_id) {
                        this._bot.processUpdate(body);
                    }
                } finally {
                    res.status(200).json({ message: 'ok' });
                }
            });
        }

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

        const listener = this._processTelegramMessage.bind(this);

        this._bot.on('message', listener);
        this._bot.on('channel_post', listener);
    }

    async configure() {
        if (process.env.NODE_ENV === 'development') {
            await this._bot.startPolling();
        } else if (process.env.NODE_ENV === 'production') {
            await this._bot.setWebHook(`${process.env.HOST_NAME}/${process.env.TELEGRAM_BOT_SECRET}`);
        }
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

                    const description = error.response?.body?.description;

                    // ? Отлавливать здесь все ошибки 400 и 403 выглядит не менее сомнительно

                    if (description === 'Forbidden: bot was blocked by the user' // заблокирован пользователем
                        || description === 'Forbidden: bot was kicked from the channel chat' // выгнали из канала
                        || description === 'Forbidden: bot was kicked from the supergroup chat' // выгнали из группы
                        || description === 'Bad Request: need administrator rights in the channel chat' // нет прав на отправку сообщений в канал
                        || description === 'Bad Request: have no rights to send a message' // нет прав на отправку сообщений в группу
                    ) {
                        await this.subscribersRepository.removeSubscriber(destination);
                        console.log(`[Telegram-bot] Подписка была удалена в связи с отозванным разрешением. Чат ${destination}`)
                        return;
                    }

                    console.log('[Telegram-bot] Во время отправки сообщения произошла непредвиденная ошибка', error);
                }
            },
            destination,
            'individual'
        );
    }

    protected async _processTelegramMessage({ text, chat }: TelegramBotApi.Message) {
        if (!text) return;

        const sender = String(chat.id);
        await this._onMessage(sender, text);
    }
}