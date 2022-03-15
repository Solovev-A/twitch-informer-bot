import dotenv from 'dotenv';
import path from 'path';

import { InformerApp } from './app';
import { TelegramBot } from './bots';
import { AddCommand, DelCommand, HelpCommand, ListCommand, StartCommand } from './commands';
import { TwitchObserver } from './observers';
import { StreamOnlineSubscription } from './subscriptions/streamOnlineSubscription';


dotenv.config({ path: path.resolve(__dirname, '..', `.env.${process.env.NODE_ENV}`) });


const app = new InformerApp({
    observers: [{
        type: TwitchObserver,
        subscriptions: [StreamOnlineSubscription]
    }],
    bots: [
        TelegramBot,
    ],
    commands: [
        StartCommand,
        AddCommand,
        DelCommand,
        ListCommand,
        HelpCommand,
    ]
});

app.start();