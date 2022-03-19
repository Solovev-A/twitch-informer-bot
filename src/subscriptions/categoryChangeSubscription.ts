import { BroadcasterRelatedCondition, ChannelUpdateEvent, ChannelUpdateEventData, EventSubscriptionConfig } from "../types";
import { SubscriptionBase } from "./subscriptionBase";


export class CategoryChangeSubscription extends SubscriptionBase<ChannelUpdateEventData, ChannelUpdateEvent> {
    eventType: ChannelUpdateEvent['eventType'];

    constructor(config: EventSubscriptionConfig<ChannelUpdateEventData, ChannelUpdateEvent>) {
        super(config);
        this.eventType = 'channel-update';
    }

    protected async _validateInputCondition(inputCondition: string): Promise<void> {
        const args = inputCondition.split(' ');
        if (args.length !== 1) throw new Error('<Условие> должно состоять только из юзернейма стримера');
    }

    protected _getEventCondition(inputCondition: string, internalCondition?: any): BroadcasterRelatedCondition {
        return {
            broadcasterUserName: inputCondition,
            broadcasterId: internalCondition
        }
    }

    protected _getActualInputCondition(eventData: ChannelUpdateEventData): string {
        return eventData.broadcasterUser.name;
    }

    protected _getMessage(eventData: ChannelUpdateEventData): string {
        return `🔄 ${eventData.broadcasterUser.name} теперь стримит ${eventData.category}\n\n` +
            `${eventData.streamUrl}`;
    }

    protected _getNewEventState(eventData: ChannelUpdateEventData) {
        return {
            lastCategoryName: eventData.category
        }
    }
}