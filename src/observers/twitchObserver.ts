import { ClientCredentialsAuthProvider } from '@twurple/auth';
import { ApiClient } from '@twurple/api';
import { EnvPortAdapter, EventSubListener, EventSubStreamOnlineEvent, EventSubChannelUpdateEvent, EventSubSubscription } from '@twurple/eventsub';
import { NgrokAdapter } from '@twurple/eventsub-ngrok';

import { StreamOnlineEvent, StreamOnlineEventData } from "../types";
import { BaseObserver } from './baseObserver';


export interface ChannelUpdateEventData {
    broadcasterUser: {
        id: string;
        name: string;
    },
    category: string
}

export interface ChannelUpdateEvent {
    eventType: 'channel-update',
    subscribeArgs: {
        userId: string,
        handler: (data: ChannelUpdateEventData) => void
    }
}

export type TwitchEvent = StreamOnlineEvent | ChannelUpdateEvent;

interface TwitchEventParams {
    eventType: keyof EventsMap,
    subscribeArgs: any
}

type EventsMap = {
    [Event in TwitchEvent as Event['eventType']]: (args: Event['subscribeArgs']) => Promise<EventSubSubscription>;
};


export class TwitchObserver extends BaseObserver<TwitchEvent> {
    protected readonly _apiClient: ApiClient;
    protected readonly _listener: EventSubListener;
    protected readonly _functionsByEventType: EventsMap;
    protected _eventSubSubscriptions: EventSubSubscription<unknown>[];

    readonly type = 'twitch';

    constructor(config: any) {
        super(config);

        const { TWITCH_CLIENT_ID,
            TWITCH_CLIENT_SECRET,
            TWITCH_SUBSCRIPTION_SECRET,
            HOST_NAME,
            NODE_ENV
        } = process.env;

        const authProvider = new ClientCredentialsAuthProvider(
            String(TWITCH_CLIENT_ID),
            String(TWITCH_CLIENT_SECRET)
        );
        const apiClient = new ApiClient({
            authProvider,
            logger: {
                minLevel: NODE_ENV === 'development' ? 'debug' : 'error'
            }
        });
        const adapter = NODE_ENV === 'development'
            ? new NgrokAdapter()
            // Необходимо следить за лимитом подписок, так как ngrok использует новые хосты после перезапуска
            : new EnvPortAdapter({
                hostName: String(HOST_NAME)
            });;
        const secret = String(TWITCH_SUBSCRIPTION_SECRET);

        this._apiClient = apiClient;
        this._listener = new EventSubListener({ apiClient, adapter, secret });
        this._eventSubSubscriptions = [];
        this._functionsByEventType = {
            'stream-online': async ({ userId, handler }) => {
                return await this._listener.subscribeToStreamOnlineEvents(userId, (e) => handler(this._mapStreamOnlineData(e)));
            },
            'channel-update': async ({ userId, handler }) => {
                return await this._listener.subscribeToChannelUpdateEvents(userId, (e) => handler(this._mapChannelUpdateData(e)));
            }
        }
    }

    async subscribe(event: TwitchEventParams) {
        const eventSubSubscription = await this._functionsByEventType[event.eventType](event.subscribeArgs);
        this._eventSubSubscriptions.push(eventSubSubscription);
    }

    async unsubscribe(subscriptionId: string): Promise<void> {
        const subscription = this._eventSubSubscriptions.find(sub => sub._twitchId === subscriptionId);
        if (subscription === undefined) throw new Error(`Подписка с id "${subscriptionId}" не найдена`)
        await subscription.stop();
        this._eventSubSubscriptions = this._eventSubSubscriptions.filter(sub => sub._twitchId !== subscriptionId);
    }

    async start(): Promise<void> {
        await this._listener.listen();

        // await this._apiClient.eventSub.deleteAllSubscriptions();
        // TODO: возобновление подписок
    }

    protected _mapStreamOnlineData(eventSubData: EventSubStreamOnlineEvent): StreamOnlineEventData {
        return {
            broadcasterUser: {
                id: eventSubData.broadcasterId,
                name: eventSubData.broadcasterDisplayName
            },
            type: eventSubData.streamType
        }
    }

    protected _mapChannelUpdateData(eventSubData: EventSubChannelUpdateEvent): ChannelUpdateEventData {
        return {
            broadcasterUser: {
                id: eventSubData.broadcasterId,
                name: eventSubData.broadcasterDisplayName
            },
            category: eventSubData.categoryName
        }
    }
}