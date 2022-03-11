import { index, modelOptions, prop } from "@typegoose/typegoose";

import { NotificationSubscription } from "../../types";

@modelOptions({ schemaOptions: { collection: 'notificationSubscriptions' } })
@index({ observer: 1, eventType: 1, inputCondition: 1 })
@index({ observer: 1, eventType: 1, internalCondition: 1 })
export class SubscriptionSchema implements NotificationSubscription {
    @prop()
    _id!: string;

    @prop({ required: true })
    observer!: string;

    @prop({ required: true })
    eventType!: string;

    @prop({ required: true })
    inputCondition!: string;

    @prop({ required: true })
    internalCondition!: any;
}