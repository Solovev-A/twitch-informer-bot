import { Express } from 'express';

export interface App {
    readonly observerByType: Map<string, EventObserver<EventDataBase, EventTypeBase<EventDataBase>>>;
    readonly bots: Bot[];
    readonly commandsByName: Map<string, Command>;
    readonly notificationSubscriptionsRepository: NotificationSubscriptionsRepository;
    readonly commandRule: CommandRule;
    readonly productionServer: Express;
    start(): Promise<void>;
}

export interface EventTypeBase<TEventData extends EventDataBase> {
    eventType: string;
    condition: any;
    handler: (eventData: TEventData) => Promise<void>;
}

export interface EventDataBase {
    subscription: NotificationSubscription;
}

export interface StreamOnlineEventData extends EventDataBase {
    broadcasterUser: {
        id: string;
        name: string;
    };
    streamUrl: string;
}

export interface StreamOnlineEvent {
    eventType: 'live';
    condition: BroadcasterRelatedCondition;
    handler: (data: StreamOnlineEventData) => Promise<void>;
}

export interface ChannelUpdateEventData extends EventDataBase {
    broadcasterUser: {
        id: string;
        name: string;
    };
    category: string;
    streamUrl: string;
    streamType?: string;
}

export interface ChannelUpdateEvent {
    eventType: 'channel-update';
    condition: BroadcasterRelatedCondition;
    handler: (data: ChannelUpdateEventData) => Promise<void>;
}

export interface BroadcasterRelatedCondition {
    broadcasterId?: string;
    broadcasterUserName: string;
}

export interface SubscribeResult {
    subscriptionId: string;
    internalCondition: any;
    initialState?: any;
}

export interface EventObserver<TEventData extends EventDataBase, TEvent extends EventTypeBase<TEventData>> {
    readonly eventSubscriptionByEventType: Map<string, EventSubscription<TEventData, TEvent>>;
    readonly type: string;
    configure(): Promise<void>;
    start(): Promise<void>;
    subscribe(event: TEvent): Promise<Response<SubscribeResult>>;
    resumeSubscription(event: TEvent): Promise<void>;
    unsubscribe(subscriptionId: string): Promise<void>;
    reset(): Promise<void>;
}

export interface EventSubscription<TEventData extends EventDataBase, TEvent extends EventTypeBase<TEventData>> {
    readonly eventType: TEvent['eventType'];
    start(inputCondition: string): Promise<Response<NotificationSubscription>>;
    resume(inputCondition: string, internalCondition: any): Promise<void>;
}

export interface EventSubscriptionConfig<TEventData extends EventDataBase, TEvent extends EventTypeBase<TEventData>> {
    observer: EventObserver<TEventData, TEvent>;
    app: App;
}

export type EventSubscriptionConstructor<TEventData extends EventDataBase, TEvent extends EventTypeBase<TEventData>>
    = new (config: EventSubscriptionConfig<TEventData, TEvent>) => EventSubscription<TEventData, TEvent>;

export interface Bot {
    readonly subscribersRepository: NotificationSubscribersRepository;
    readonly commandPrefix: string;
    sendMessage(destination: string, message: string): Promise<void>;
    configure(): Promise<void>;
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
    state?: any;
}

export interface NotificationSubscriptionsRepository {
    listAllSubscriptions(): Promise<NotificationSubscription[]>;
    create(newSubscription: NotificationSubscription): Promise<NotificationSubscription>;
    findById(id: string): Promise<NotificationSubscription | null>;
    findWithInputCondition(subscriptionParams: Pick<NotificationSubscription, 'eventType' | 'inputCondition' | 'observer'>): Promise<NotificationSubscription | null>;
    updateInputCondition(subscriptionId: string, newValue: string): Promise<NotificationSubscription>;
    updateState(subscriptionId: string, newState: any): Promise<void>;
    remove(id: string): Promise<void>;
    clear(): Promise<void>;
}

export interface NotificationSubscribersRepository {
    listAddresses(subscriptionId: string): Promise<string[]>;
    listSubscriptions(address: string): Promise<NotificationSubscription[]>;
    checkSubscriptionsLimit(address: string): Promise<{ result: boolean, limit: number }>;
    addSubscription(address: string, subscriptionId: string): Promise<Response<NotificationSubscriber>>;
    removeSubscription(address: string, subscriptionId: string): Promise<Response<NotificationSubscriber>>;
    removeSubscriber(address: string): Promise<void>;
    clear(): Promise<void>;
}

export interface Response<T> {
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

export interface CommandRule {
    parse(rawArgs: string[]): {
        observer: string;
        eventType: string;
        inputCondition: string;
    };
    template: string;
    example: string;
}