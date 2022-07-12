import { ClientCredentialsAuthProvider } from '@twurple/auth';
import { ApiClient } from '@twurple/api';
import { EventSubBase } from '@twurple/eventsub/lib/EventSubBase';
import { EventSubStreamOnlineEvent, EventSubChannelUpdateEvent, EventSubSubscription, EventSubMiddleware, EventSubListener } from '@twurple/eventsub';
import { NgrokAdapter } from '@twurple/eventsub-ngrok';

import { ChannelUpdateEvent, ChannelUpdateEventData, NotificationSubscription, Response, StreamOnlineEvent, StreamOnlineEventData, SubscribeResult } from "../types";
import { BaseObserver, BaseObserverConfig } from './baseObserver';
import { delay } from '../utils';
import { Env } from '../utils/env';


export type TwitchEvent = StreamOnlineEvent | ChannelUpdateEvent;

interface TwitchEventParams {
    eventType: keyof EventsMap,
    condition: TwitchEvent['condition'];
    handler: (...args: unknown[]) => Promise<void>;
}

type EventsMap = {
    [Event in TwitchEvent as Event['eventType']]: (condition: Event['condition'], handler: Event['handler'], isResumed: boolean)
        => Promise<Omit<SubscribeResult, 'internalCondition'>>;
};

interface SubscribeWithNotificationSubscriptionProcessorConfig<TCondition, TEventData, THandlerData> {
    method: (condition: TCondition, handler: (data: TEventData) => void) => Promise<EventSubSubscription<unknown>>,
    condition: TCondition,
    getInitialState?: (condition: TCondition) => Promise<any>;
    shouldHandle: (data: TEventData, subscription: NotificationSubscription) => boolean;
    mapToHandlerData: (data: TEventData, subscription: NotificationSubscription) => Promise<THandlerData>;
    handler: (data: THandlerData) => Promise<void>;
    isStarting: boolean;
}


export class TwitchObserver extends BaseObserver<any, TwitchEvent> {
    protected readonly _apiClient: ApiClient;
    protected readonly _eventSub: EventSubBase;
    protected readonly _functionsByEventType: EventsMap;
    protected readonly baseUrl = 'https://www.twitch.tv/';
    protected _eventSubSubscriptions: EventSubSubscription<unknown>[];

    readonly type = 'twitch';

    constructor(config: BaseObserverConfig<any, TwitchEvent>) {
        super(config);

        const authProvider = new ClientCredentialsAuthProvider(
            Env.get('TWITCH_CLIENT_ID'),
            Env.get('TWITCH_CLIENT_SECRET')
        );
        const apiClient = new ApiClient({
            authProvider,
            logger: {
                minLevel: Env.isDevelopment ? 'debug' : 'error'
            }
        });
        const secret = Env.get('TWITCH_SUBSCRIPTION_SECRET');

        this._apiClient = apiClient;

        if (Env.isProduction) {
            this._eventSub = new EventSubMiddleware({
                apiClient,
                hostName: Env.get('HOST_NAME'),
                pathPrefix: '/twitch',
                secret
            });
        } else {
            const adapter = new NgrokAdapter()
            // Необходимо следить за лимитом подписок, так как ngrok использует новые хосты после перезапуска
            this._eventSub = new EventSubListener({ apiClient, adapter, secret });
        }

        this._eventSub.onRevoke((eventSubSubscription) => {
            const id = eventSubSubscription._twitchId;
            if (!id) return;
            this._handleRevocation(id);
        })

        this._eventSubSubscriptions = [];
        this._functionsByEventType = {
            'live': async (condition, handler, isStarting) => {
                const broadcasterId = condition.broadcasterId!;
                return await this._processWithNotificationSubscription({
                    method: this._eventSub.subscribeToStreamOnlineEvents.bind(this._eventSub),
                    condition: broadcasterId,
                    shouldHandle: (data) => data.streamType === 'live',
                    mapToHandlerData: this._mapStreamOnlineData,
                    handler,
                    isStarting,
                });
            },
            'channel-update': async (condition, handler, isStarting) => {
                const broadcasterId = condition.broadcasterId!;

                const getInitialState = async (broadcasterId: string) => {
                    const info = await this._apiClient.channels.getChannelInfoById(broadcasterId);
                    const lastCategoryName = info?.gameName ?? '';

                    return { lastCategoryName }
                };

                return await this._processWithNotificationSubscription({
                    method: this._eventSub.subscribeToChannelUpdateEvents.bind(this._eventSub),
                    condition: broadcasterId,
                    getInitialState,
                    shouldHandle: (data, sub) => data.categoryName !== sub.state.lastCategoryName,
                    mapToHandlerData: this._mapChannelUpdateData,
                    handler,
                    isStarting,
                });
            }
        }
    }

    async subscribe({ eventType, condition, handler }: TwitchEventParams): Promise<Response<SubscribeResult>> {
        const { broadcasterUserName, broadcasterId } = condition;
        const userId = broadcasterId ?? await this._getUserId(broadcasterUserName);
        if (userId === null) {
            return {
                errorMessage: `Пользователь с именем "${broadcasterUserName}" не найден`
            }
        }

        try {
            const subscribeResult = await this._functionsByEventType[eventType]({ ...condition, broadcasterId: userId }, handler, true);

            return {
                result: {
                    ...subscribeResult,
                    internalCondition: userId
                }
            }
        } catch (error) {
            const logMessage = `[Twitch observer] Ошибка во время создания подписки.
            EventType: ${eventType}, Condition: ${condition}\n`
            console.log(logMessage, error);

            return {
                errorMessage: 'Во время создания подписки произошла ошибка. Попробуйте повторить попытку позже.'
            }
        }
    }

    async resumeSubscription({ eventType, condition, handler }: TwitchEventParams): Promise<void> {
        try {
            await this._functionsByEventType[eventType](condition, handler, false);
        } catch (error) {
            const logMessage = `[Twitch observer] Ошибка во время возобновления подписки.
            EventType: ${eventType}, Condition: ${condition}\n`
            console.log(logMessage, error);
        }
    }

    async unsubscribe(subscriptionId: string): Promise<void> {
        const subscription = this._eventSubSubscriptions.find(sub => sub._twitchId === subscriptionId);
        if (subscription === undefined) throw new Error(`Подписка с id "${subscriptionId}" не найдена`)
        try {
            await subscription.stop();
        } catch (error) {
            console.log('[Twitch observer] Ошибка при остановке подписки на событие', error)
            return;
        }
        this._eventSubSubscriptions = this._eventSubSubscriptions.filter(sub => sub._twitchId !== subscriptionId);
    }

    async configure(): Promise<void> {
        if (Env.isProduction) {
            await (this._eventSub as EventSubMiddleware).apply(this._app.productionServer);
        }
    }

    async start(): Promise<void> {
        if (Env.isProduction) {
            await (this._eventSub as EventSubMiddleware).markAsReady();
        } else {
            await (this._eventSub as EventSubListener).listen();
        }
    }

    async reset(): Promise<void> {
        await this._apiClient.eventSub.deleteAllSubscriptions();
    }

    protected async _processWithNotificationSubscription<TCondition, TEventData, THandlerData>(
        config: SubscribeWithNotificationSubscriptionProcessorConfig<TCondition, TEventData, THandlerData>
    ): Promise<Omit<SubscribeResult, 'internalCondition'>> {
        const { condition, handler, mapToHandlerData, method, shouldHandle, getInitialState, isStarting } = config;

        // Twurple не передает данные подписки в обработчик, поэтому:
        // 1. Подписываемся на событие без обработчика, чтобы twitch зарегистрировал подписку
        let eventSubSubscription = await method(condition, (e) => { });
        let initialState = undefined;

        if (isStarting) {
            // 2. Ждем, пока twitch верифицирует подписку, иначе twurple попытается подписаться снова, и это закончится ошибкой
            let timeout = Number(Env.get('TWITCH_VERIFICATION_TIMEOUT', '60')) * 1000;
            const step = 0.3 * 1000;

            while (!eventSubSubscription.verified && timeout > 0) {
                await delay(step);
                timeout -= step;
            }

            if (!eventSubSubscription.verified) {
                await eventSubSubscription.stop();
                throw new Error('Не удалось подтвердить подписку');
            }

            if (getInitialState !== undefined) {
                const notificationSubscription = await this._app.notificationSubscriptionsRepository.findById(eventSubSubscription._twitchId!);
                if (notificationSubscription === null) {
                    initialState = await getInitialState(condition);
                }
            }
        }

        // 3. При попытке переподписаться на уже существующее верифицированное событие, 
        // twurple не будет отправлять запрос, а лишь заменит обработчик
        eventSubSubscription = await method(condition, async (eventSubData) => {
            try {
                const notificationSubscription = await this._app.notificationSubscriptionsRepository.findById(eventSubSubscription._twitchId!);

                if (notificationSubscription === null) return;
                if (!shouldHandle(eventSubData, notificationSubscription)) return;

                const handlerData = await mapToHandlerData(eventSubData, notificationSubscription);
                await handler(handlerData);
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

    protected _mapStreamOnlineData = async (eventSubData: EventSubStreamOnlineEvent, subscription: NotificationSubscription): Promise<StreamOnlineEventData> => ({
        broadcasterUser: {
            id: eventSubData.broadcasterId,
            name: eventSubData.broadcasterDisplayName
        },
        streamUrl: this.baseUrl + eventSubData.broadcasterName,
        subscription
    });

    protected _mapChannelUpdateData = async (eventSubData: EventSubChannelUpdateEvent, subscription: NotificationSubscription): Promise<ChannelUpdateEventData> => {
        const stream = await this._apiClient.streams.getStreamByUserId(eventSubData.broadcasterId);

        return {
            broadcasterUser: {
                id: eventSubData.broadcasterId,
                name: eventSubData.broadcasterDisplayName
            },
            category: eventSubData.categoryName,
            streamUrl: this.baseUrl + eventSubData.broadcasterName,
            streamType: stream?.type,
            subscription,
        }
    };

    protected async _getUserId(name: string): Promise<string | null> {
        const user = await this._apiClient.users.getUserByName(name);
        return user?.id ?? null;
    }
}