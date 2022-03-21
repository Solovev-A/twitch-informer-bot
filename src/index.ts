import dotenv from 'dotenv';
import path from 'path';

import { InformerApp } from './app';
import { DiscordBot, TelegramBot } from './bots';
import { AddCommand, DelCommand, HelpCommand, ListCommand, StartCommand } from './commands';
import { TwitchCategoryInformerRule } from './commands/rules/twitchCategoryInformerRule';
import { TwitchObserver } from './observers';
import { CategoryChangeSubscription, StreamOnlineSubscription } from './subscriptions';


dotenv.config({ path: path.resolve(__dirname, '..', `.env.${process.env.NODE_ENV}`) });


const app = new InformerApp({
    observers: [{
        type: TwitchObserver,
        subscriptions: [StreamOnlineSubscription, CategoryChangeSubscription]
    }],
    bots: [
        TelegramBot,
        DiscordBot,
    ],
    commands: [
        StartCommand,
        AddCommand,
        DelCommand,
        ListCommand,
        HelpCommand,
    ],
    commandRule: new TwitchCategoryInformerRule()
});

app.start();