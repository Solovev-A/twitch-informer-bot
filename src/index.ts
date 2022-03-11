import dotenv from 'dotenv';
import path from 'path';

import { InformerApp } from './app';
import { TwitchObserver } from './observers/twitchObserver';
import { StreamOnlineSubscription } from './subscriptions/streamOnlineSubscription';


dotenv.config({ path: path.resolve(__dirname, '..', `.env.${process.env.NODE_ENV}`) });


const app = new InformerApp({
    observers: [{
        type: TwitchObserver,
        subscriptions: [StreamOnlineSubscription]
    }],
    commands: []
});

app.start();