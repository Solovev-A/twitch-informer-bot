import { EventSubscriptionConfig, App, EventObserver, EventSubscription, StreamOnlineEvent, SubscribeResult, NotificationSubscription, StreamOnlineEventData } from "../types";
import { SubscriptionBase } from "./subscriptionBase";


export class StreamOnlineSubscription extends SubscriptionBase<StreamOnlineEvent> {
    readonly eventType: StreamOnlineEvent['eventType'];

    constructor(config: EventSubscriptionConfig<StreamOnlineEvent>) {
        super(config);
        this.eventType = 'live';
    }

    protected async _validateInputCondition(inputCondition: string): Promise<void> {
        const args = inputCondition.split(' ');
        if (args.length !== 1) throw new Error('<Условие> должно состоять только из юзернейма стримера');
    }

    protected _getEventCondition(inputCondition: string, internalCondition?: any): StreamOnlineEvent['condition'] {
        return {
            broadcasterUserName: inputCondition,
            broadcasterId: internalCondition
        }
    }

    protected _getInternalCondition(data: StreamOnlineEventData) {
        return data.broadcasterUser.id;
    }

    protected _getActualInputCondition(data: StreamOnlineEventData): string {
        return data.broadcasterUser.name;
    }

    protected _getMessage(data: StreamOnlineEventData): string {
        return `🔴 ${data.broadcasterUser.name} теперь онлайн!\n` +
            `${this._observer.baseUrl}/${data.broadcasterUser.name}`;
    }
}