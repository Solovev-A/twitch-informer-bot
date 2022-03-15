export interface App {
    readonly observerByType: Map<string, EventObserver<EventTypeBase>>;
    readonly bots: Bot[];
    readonly commandsByName: Map<string, Command>;
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
    start(inputCondition: string): Promise<NotificationSubscription>;
    resume(inputCondition: string, internalCondition: any): Promise<void>;
}

export interface EventSubscriptionConfig<TEvent extends EventTypeBase> {
    observer: EventObserver<TEvent>;
    app: App;
}

export type EventSubscriptionConstructor<TEvent extends EventTypeBase>
    = new (config: EventSubscriptionConfig<TEvent>) => EventSubscription<TEvent>;

export interface Bot {
    readonly subscribersRepository: NotificationSubscribersRepository;
    readonly commandPrefix: string;
    sendMessage(destination: string, message: string): Promise<void>;
}

export interface NotificationSubscriber {
    address: string;
    subscriptions: NotificationSubscription[] | any;
    subscriptionsLimit: number;
}

export interface NotificationSubscription {
    _id: string;
    observer: string;
    eventType: string;
    inputCondition: string;
    internalCondition: any;
}

export interface NotificationSubscriptionsRepository {
    listAllSubscriptions(): Promise<NotificationSubscription[]>;
    create(newSubscription: NotificationSubscription): Promise<NotificationSubscription>;
    findWithInternalCondition(subscriptionParams: Pick<NotificationSubscription, 'eventType' | 'internalCondition' | 'observer'>): Promise<NotificationSubscription | null>;
    findWithInputCondition(subscriptionParams: Pick<NotificationSubscription, 'eventType' | 'inputCondition' | 'observer'>): Promise<NotificationSubscription | null>;
    updateInputCondition(subscriptionId: string, newValue: string): Promise<NotificationSubscription>;
    remove(id: string): Promise<void>;
}

export interface NotificationSubscribersRepository {
    listAddresses(subscriptionId: string): Promise<string[]>;
    listSubscriptions(address: string): Promise<NotificationSubscription[]>;
    addSubscription(address: string, subscriptionId: string): Promise<RepositoryResponse<NotificationSubscriber>>;
    removeSubscription(address: string, subscriptionId: string): Promise<RepositoryResponse<NotificationSubscriber>>;
}

export interface RepositoryResponse<T> {
    errorMessage?: string;
    result?: T
}

export interface Command {
    readonly name: string;
    readonly description: string;
    execute(params: CommandParams): Promise<void>;
}

export interface CommandParams {
    bot: Bot;
    sender: string;
    rawArgs: string[];
}