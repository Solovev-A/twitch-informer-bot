import { prop, Ref } from "@typegoose/typegoose";

import { NotificationSubscriber } from "../../types";
import { SubscriptionSchema } from "./subscriptionSchema";


export class SubscriberSchema implements NotificationSubscriber {
    @prop({ required: true, unique: true })
    address!: string;

    @prop({ index: true, ref: () => SubscriptionSchema, type: () => String })
    subscriptions!: Ref<SubscriptionSchema, string>[];

    @prop({ required: true })
    subscriptionsLimit!: number;
}