import dotenv from 'dotenv';
import path from 'path';

import { InformerApp } from './app';
import { StartCommand } from './commands/startCommand';
import { AddCommand } from './commands/addCommand';
import { TwitchObserver } from './observers/twitchObserver';
import { StreamOnlineSubscription } from './subscriptions/streamOnlineSubscription';
import { DelCommand } from './commands/delCommand';
import { ListCommand } from './commands/listCommand';
import { HelpCommand } from './commands/helpCommand';


dotenv.config({ path: path.resolve(__dirname, '..', `.env.${process.env.NODE_ENV}`) });


const app = new InformerApp({
    observers: [{
        type: TwitchObserver,
        subscriptions: [StreamOnlineSubscription]
    }],
    commands: [
        StartCommand,
        AddCommand,
        DelCommand,
        ListCommand,
        HelpCommand
    ]
});

app.start();