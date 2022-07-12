import { Client } from "discord.js";

import { App, NotificationSubscribersRepository } from "../types";
import { BotBase } from "./botBase";
import { MongodbNotificationSubscribersRepository } from './../db/mongodbNotificationSubscribersRepository';
import { SubscriberSchema } from "../db/schemas/subscriberSchema";
import { Env } from '../utils/env';


class DiscordSubscriber extends SubscriberSchema { }

export class DiscordBot extends BotBase {
    protected readonly _client;

    commandPrefix = '!infobot ';
    subscribersRepository: NotificationSubscribersRepository;

    constructor(app: App) {
        super(app);
        this.subscribersRepository = new MongodbNotificationSubscribersRepository(DiscordSubscriber);

        this._client = new Client({ intents: ['GUILDS', 'GUILD_MESSAGES'] });

        this._client.on('messageCreate', async (message) => {
            if (message.author.bot || !message.member?.permissions.has('MANAGE_MESSAGES')) return;

            const sender = message.channelId;
            await this._onMessage(sender, message.content);
        })

        this._client.login(Env.get('DISCORD_BOT_TOKEN'));
    }

    configure(): Promise<void> {
        return Promise.resolve();
    }

    async sendMessage(destination: string, message: string): Promise<void> {
        if (!this._client.isReady()) return;

        const channel = this._client.channels.cache.get(destination);

        if (!channel || !channel.isText()) {
            await this._removeSubscriber(destination);
            return;
        }

        try {
            await channel.send(message);
        } catch (error: any) {
            if (error.code === 50013) {
                // возникает в случае наложения "тайм-аута" на бота

                await this._removeSubscriber(destination);
                return;
            }

            console.log('[Discord bot]: Непредвиденная ошибка при отправке сообщения', error)
        }
    }

    protected async _removeSubscriber(channelId: string) {
        await this.subscribersRepository.removeSubscriber(channelId);
        console.log(`[Discord bot]: Подписка была удалена в связи с отозванным разрешением: канал ${channelId}`);
    }
}