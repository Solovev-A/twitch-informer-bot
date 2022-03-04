import { ClientCredentialsAuthProvider } from '@twurple/auth';
import { ApiClient } from '@twurple/api';
import { EnvPortAdapter, EventSubListener, EventSubStreamOnlineEvent, EventSubChannelUpdateEvent, EventSubSubscription } from '@twurple/eventsub';
import { NgrokAdapter } from '@twurple/eventsub-ngrok';

import { StreamOnlineEvent, StreamOnlineEventData, SubscribeResult } from "../types";
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
    condition: {
        broadcasterId?: string;
        broadcasterUserName: string;
    };
    handler: (data: ChannelUpdateEventData) => void;
}

export type TwitchEvent = StreamOnlineEvent | ChannelUpdateEvent;

interface TwitchEventParams {
    eventType: keyof EventsMap,
    condition: TwitchEvent['condition'];
    handler: (...args: unknown[]) => void;
}

type EventsMap = {
    [Event in TwitchEvent as Event['eventType']]: (condition: Event['condition'], handler: Event['handler']) => Promise<EventSubSubscription>;
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
            'stream-online': async ({ broadcasterId }, handler) => {
                return await this._listener.subscribeToStreamOnlineEvents(broadcasterId!, (e) => handler(this._mapStreamOnlineData(e)));
            },
            'channel-update': async ({ broadcasterId }, handler) => {
                return await this._listener.subscribeToChannelUpdateEvents(broadcasterId!, (e) => handler(this._mapChannelUpdateData(e)));
            }
        }
    }

    async subscribe({ eventType, condition, handler }: TwitchEventParams): Promise<SubscribeResult> {
        const { broadcasterUserName, broadcasterId } = condition;
        const userId = !broadcasterId ? await this._getUserId(broadcasterUserName) : broadcasterId;
        const eventSubSubscription = await this._functionsByEventType[eventType]({ ...condition, broadcasterId: userId }, handler);
        this._eventSubSubscriptions.push(eventSubSubscription);

        return {
            subscriptionId: eventSubSubscription._twitchId!,
            internalCondition: userId
        }
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

    protected async _getUserId(name: string): Promise<string> {
        const user = await this._apiClient.users.getUserByName(name);
        if (user === null) throw new Error(`Пользователь с именем "${name}" не найден`);
        return user.id;
    }
}