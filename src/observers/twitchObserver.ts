import { ClientCredentialsAuthProvider } from '@twurple/auth';
import { ApiClient } from '@twurple/api';
import { EnvPortAdapter, EventSubListener, EventSubStreamOnlineEvent, EventSubChannelUpdateEvent, EventSubSubscription } from '@twurple/eventsub';
import { NgrokAdapter } from '@twurple/eventsub-ngrok';

import { ChannelUpdateEvent, ChannelUpdateEventData, NotificationSubscription, StreamOnlineEvent, StreamOnlineEventData, SubscribeResult } from "../types";
import { BaseObserver, BaseObserverConfig } from './baseObserver';
import { delay } from '../utils';


export type TwitchEvent = StreamOnlineEvent | ChannelUpdateEvent;

interface TwitchEventParams {
    eventType: keyof EventsMap,
    condition: TwitchEvent['condition'];
    handler: (...args: unknown[]) => Promise<void>;
}

type EventsMap = {
    [Event in TwitchEvent as Event['eventType']]: (condition: Event['condition'], handler: Event['handler'])
        => Promise<Omit<SubscribeResult, 'internalCondition'>>;
};

interface SubscribeWithNotificationSubscriptionProcessorConfig<TCondition, TEventData, THandlerData> {
    method: (condition: TCondition, handler: (data: TEventData) => void) => Promise<EventSubSubscription<unknown>>,
    condition: TCondition,
    getInitialState?: (condition: TCondition) => Promise<any>;
    shouldHandle: (data: TEventData, subscription: NotificationSubscription) => boolean,
    mapToHandlerData: (data: TEventData, subscription: NotificationSubscription) => THandlerData,
    handler: (data: THandlerData) => Promise<void>
}


export class TwitchObserver extends BaseObserver<any, TwitchEvent> {
    protected readonly _apiClient: ApiClient;
    protected readonly _listener: EventSubListener;
    protected readonly _functionsByEventType: EventsMap;
    protected readonly baseUrl = 'https://www.twitch.tv/';
    protected _eventSubSubscriptions: EventSubSubscription<unknown>[];

    readonly type = 'twitch';

    constructor(config: BaseObserverConfig<any, TwitchEvent>) {
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
            'live': async (condition, handler) => {
                const broadcasterId = condition.broadcasterId!;
                return await this._processWithNotificationSubscription({
                    method: this._listener.subscribeToStreamOnlineEvents.bind(this._listener),
                    condition: broadcasterId,
                    shouldHandle: (data) => data.streamType === 'live',
                    mapToHandlerData: this._mapStreamOnlineData,
                    handler,
                });
            },
            'channel-update': async (condition, handler) => {
                const broadcasterId = condition.broadcasterId!;

                const getInitialState = async (broadcasterId: string) => {
                    const info = await this._apiClient.channels.getChannelInfo(broadcasterId);
                    const lastCategoryName = info?.gameName ?? '';

                    return { lastCategoryName }
                };

                return await this._processWithNotificationSubscription({
                    method: this._listener.subscribeToChannelUpdateEvents.bind(this._listener),
                    condition: broadcasterId,
                    getInitialState,
                    shouldHandle: (data, sub) => data.categoryName !== sub.state.lastCategoryName,
                    mapToHandlerData: this._mapChannelUpdateData,
                    handler,
                });
            }
        }
    }

    async subscribe({ eventType, condition, handler }: TwitchEventParams): Promise<SubscribeResult> {
        const { broadcasterUserName, broadcasterId } = condition;
        const userId = broadcasterId ?? await this._getUserId(broadcasterUserName);
        try {
            const result = await this._functionsByEventType[eventType]({ ...condition, broadcasterId: userId }, handler);

            return {
                ...result,
                internalCondition: userId
            }
        } catch (error) {
            console.log(error);
            throw new Error('Во время создания подписки произошла ошибка. Попробуйте повторить попытку позже.');
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
    }

    async reset(): Promise<void> {
        await this._apiClient.eventSub.deleteAllSubscriptions();
    }

    protected async _processWithNotificationSubscription<TCondition, TEventData, THandlerData>(
        config: SubscribeWithNotificationSubscriptionProcessorConfig<TCondition, TEventData, THandlerData>
    ): Promise<Omit<SubscribeResult, 'internalCondition'>> {
        const { condition, handler, mapToHandlerData, method, shouldHandle, getInitialState } = config;

        // Twurple не передает данные подписки в обработчик, поэтому:
        // 1. Подписываемся на событие без обработчика, чтобы twitch зарегистрировал подписку
        let eventSubSubscription = await method(condition, (e) => { });

        // 2. Ждем, пока twitch верифицирует подписку, иначе twurple попытается подписаться снова, и это закончится ошибкой
        let timeout = 30 * 1000;
        const step = 0.3 * 1000;

        while (!eventSubSubscription.verified && timeout > 0) {
            await delay(step);
            timeout -= step;
        }

        if (!eventSubSubscription.verified) {
            await eventSubSubscription.stop();
            throw new Error('Не удалось подтвердить подписку');
        }

        let initialState = undefined;
        if (getInitialState !== undefined) {
            const notificationSubscription = await this._app.notificationSubscriptionsRepository.findById(eventSubSubscription._twitchId!);
            if (notificationSubscription === null) {
                initialState = await getInitialState(condition);
            }
        }

        // 3. При попытке переподписаться на уже существующее верифицированное событие, 
        // twurple не будет отправлять запрос, а лишь заменит обработчик
        eventSubSubscription = await method(condition, async (eventSubData) => {
            const notificationSubscription = await this._app.notificationSubscriptionsRepository.findById(eventSubSubscription._twitchId!);

            if (notificationSubscription === null) return;
            if (!shouldHandle(eventSubData, notificationSubscription)) return;

            try {
                await handler(mapToHandlerData(eventSubData, notificationSubscription));
            } catch (error) {
                console.log('При обработке данных о событии произошла ошибка', error)
            }
        });

        this._eventSubSubscriptions.push(eventSubSubscription);
        return {
            initialState: initialState,
            subscriptionId: eventSubSubscription._twitchId!,
        }
    }

    protected _mapStreamOnlineData(eventSubData: EventSubStreamOnlineEvent, subscription: NotificationSubscription): StreamOnlineEventData {
        return {
            broadcasterUser: {
                id: eventSubData.broadcasterId,
                name: eventSubData.broadcasterDisplayName
            },
            streamUrl: this.baseUrl + eventSubData.broadcasterName,
            subscription
        }
    }

    protected _mapChannelUpdateData(eventSubData: EventSubChannelUpdateEvent, subscription: NotificationSubscription): ChannelUpdateEventData {
        return {
            broadcasterUser: {
                id: eventSubData.broadcasterId,
                name: eventSubData.broadcasterDisplayName
            },
            category: eventSubData.categoryName,
            streamUrl: this.baseUrl + eventSubData.broadcasterName,
            subscription
        }
    }

    protected async _getUserId(name: string): Promise<string> {
        const user = await this._apiClient.users.getUserByName(name);
        if (user === null) throw new Error(`Пользователь с именем "${name}" не найден`);
        return user.id;
    }
}