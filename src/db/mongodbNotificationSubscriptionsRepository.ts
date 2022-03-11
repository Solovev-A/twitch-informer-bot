import { getModelForClass } from "@typegoose/typegoose";

import { NotificationSubscription, NotificationSubscriptionsRepository } from "../types";
import { SubscriptionSchema } from "./schemas/subscribtionSchema";


export class MongodbNotificationSubscriptionsRepository implements NotificationSubscriptionsRepository {
    protected _model;

    constructor() {
        this._model = getModelForClass(SubscriptionSchema);
    }

    async listAllSubscriptions(): Promise<NotificationSubscription[]> {
        return await this._model.find({}).exec();
    }

    async create(newSubscription: NotificationSubscription): Promise<NotificationSubscription> {
        return await this._model.create({ ...newSubscription });
    }

    async findWithInternalCondition(subscriptionParams: Pick<NotificationSubscription, "eventType" | "internalCondition" | "observer">): Promise<NotificationSubscription | null> {
        return await this._findSubscription(subscriptionParams);
    }

    async findWithInputCondition(subscriptionParams: Pick<NotificationSubscription, "eventType" | "observer" | "inputCondition">): Promise<NotificationSubscription | null> {
        return await this._findSubscription(subscriptionParams);
    }

    async updateInputCondition(subscriptionId: string, newValue: string): Promise<NotificationSubscription> {
        const subscription = await this._findSubscription({ _id: subscriptionId });

        if (!subscription) throw new Error('Подписка не найдена');

        subscription.inputCondition = newValue;
        await subscription.save();

        return subscription;
    }

    async remove(id: string): Promise<void> {
        await this._model
            .deleteOne({ _id: id })
            .exec();
    }

    protected async _findSubscription(params: Partial<NotificationSubscription>) {
        return await this._model
            .findOne(params)
            .exec();
    }
}