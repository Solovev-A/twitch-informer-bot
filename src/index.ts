import dotenv from 'dotenv';
import path from 'path';

import { InformerApp } from './app';
import { DiscordBot, TelegramBot } from './bots';
import { AddCommand, DelCommand, HelpCommand, ListCommand, StartCommand } from './commands';
import { TwitchCategoryInformerRule } from './commands/rules/twitchCategoryInformerRule';
import { TwitchObserver } from './observers';
import { CategoryChangeSubscription, StreamOnlineSubscription } from './subscriptions';
import { Env } from './utils/env';


dotenv.config({ path: path.resolve(__dirname, '..', `.env.${Env.get('NODE_ENV')}`) });


InformerApp.create({
    observers: [{
        type: TwitchObserver,
        subscriptions: [StreamOnlineSubscription, CategoryChangeSubscription]
    }],
    bots: [
        TelegramBot,
        // DiscordBot,
    ],
    commands: [
        StartCommand,
        AddCommand,
        DelCommand,
        ListCommand,
        HelpCommand,
    ],
    commandRule: new TwitchCategoryInformerRule()
}).then(app => app.start());