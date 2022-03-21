import { EventSubscriptionConfig, Response, StreamOnlineEvent, StreamOnlineEventData } from "../types";
import { SubscriptionBase } from "./subscriptionBase";


export class StreamOnlineSubscription extends SubscriptionBase<StreamOnlineEventData, StreamOnlineEvent> {
    readonly eventType: StreamOnlineEvent['eventType'];

    constructor(config: EventSubscriptionConfig<StreamOnlineEventData, StreamOnlineEvent>) {
        super(config);
        this.eventType = 'live';
    }

    protected _validateInputCondition(inputCondition: string): Response<boolean> {
        const args = inputCondition.split(' ');
        if (args.length !== 1) return { errorMessage: '<Условие> должно состоять только из юзернейма стримера' }
        if (args[0] === '') return { errorMessage: 'Не задано условие - юзернейм стримера' }
        return { result: true }
    }

    protected _getEventCondition(inputCondition: string, internalCondition?: any): StreamOnlineEvent['condition'] {
        return {
            broadcasterUserName: inputCondition,
            broadcasterId: internalCondition
        }
    }

    protected _getActualInputCondition(data: StreamOnlineEventData): string {
        return data.broadcasterUser.name;
    }

    protected _getMessage(data: StreamOnlineEventData): string {
        return `🔴 ${data.broadcasterUser.name} - онлайн!\n\n` +
            `${data.streamUrl}`;
    }

    protected _getNewEventState(eventData: StreamOnlineEventData) {
        return undefined;
    }
}