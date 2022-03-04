export interface App {
    readonly observerByType: Map<string, EventObserver<EventTypeBase>>;
    readonly bots: Bot[];
    readonly notificationSubscriptionsRepository: NotificationSubscriptionsRepository;
    start(): Promise<void>;
}

export interface EventTypeBase {
    eventType: string;
    condition: any;
    handler: (...args: any[]) => void;
}

export interface StreamOnlineEventData {
    broadcasterUser: {
        id: string;
        name: string;
    };
    type: string
}

export interface StreamOnlineEvent {
    eventType: 'stream-online';
    condition: {
        broadcasterId?: string;
        broadcasterUserName: string;
    };
    handler: (data: StreamOnlineEventData) => void;
}

export interface SubscribeResult {
    subscriptionId: string;
    internalCondition: any;
}

export interface EventObserver<TEvent extends EventTypeBase> {
    readonly eventSubscriptionByEventType: Map<string, EventSubscription<TEvent>>;
    readonly type: string;
    start(): Promise<void>;
    subscribe(event: TEvent): Promise<SubscribeResult>;
    unsubscribe(subscriptionId: string): Promise<void>;
}

export interface EventSubscription<TEvent extends EventTypeBase> {
    readonly eventType: TEvent['eventType'];
    start(...args: unknown[]): Promise<void>;
    resume(...args: unknown[]): Promise<void>;
}

export interface EventSubscriptionConfig<TEvent extends EventTypeBase> {
    observer: EventObserver<TEvent>;
    app: App;
}

export type EventSubscriptionConstructor<TEvent extends EventTypeBase>
    = new (config: EventSubscriptionConfig<TEvent>) => EventSubscription<TEvent>;

export interface Bot {
    readonly subscribersRepository: NotificationSubscribersRepository;
    sendMessage(destination: string, message: string): Promise<void>;
}

export interface NotificationSubscriber {
    address: string;
    subscriptions: NotificationSubscription[];
    subscriptionsLimit: number;
}

export interface NotificationSubscription {
    _id: string;
    observer: string;
    eventType: string;
    inputCondition: string;
    internalCondition: any;
    subscribersCount: number;
}

export interface NotificationSubscriptionsRepository {
    listAllSubscriptions(): Promise<NotificationSubscription[]>;
    create(newSubscription: Omit<NotificationSubscription, 'subscribersCount'>): Promise<NotificationSubscription>;
    updateInternalCondition(newValue: any): Promise<NotificationSubscription>;
    remove(id: string): Promise<void>
}

export interface NotificationSubscribersRepository {
    listSubscribers(subscriptionParams: Pick<NotificationSubscription, 'eventType' | 'internalCondition' | 'observer'>): Promise<NotificationSubscriber[]>;
    listSubscriptions(address: string): Promise<NotificationSubscription[]>;
    addSubscription(address: string, subscriptionId: string): Promise<NotificationSubscriber>;
    removeSubscription(address: string, subscriptionId: string): Promise<NotificationSubscriber>;
}