import { getModelForClass } from "@typegoose/typegoose";

import { NotificationSubscriber, NotificationSubscribersRepository, NotificationSubscription, Response } from "../types";
import { SubscriberSchema } from "./schemas/subscriberSchema";
import { SubscriptionSchema } from './schemas/subscriptionSchema';
import { DEFAULT_SUBSCRIPTIONS_LIMIT } from "../utils/constants";


export class MongodbNotificationSubscribersRepository<T extends typeof SubscriberSchema> implements NotificationSubscribersRepository {
    protected _model;

    constructor(schemaClass: T) {
        this._model = getModelForClass(schemaClass);
    }

    async checkSubscriptionsLimit(address: string): Promise<{ result: boolean, limit: number }> {
        const subscriber = await this._model
            .findOne({ address })
            .exec();

        if (!subscriber) {
            return {
                result: true,
                limit: DEFAULT_SUBSCRIPTIONS_LIMIT
            }
        }

        return {
            result: subscriber.subscriptions.length < subscriber.subscriptionsLimit,
            limit: subscriber.subscriptionsLimit
        };
    }

    async clear(): Promise<void> {
        await this._model.deleteMany({}).exec();
    }

    async listAddresses(subscriptionId: string): Promise<string[]> {
        const subscribers = await this._model
            .find({ subscriptions: subscriptionId })
            .exec();

        return subscribers.map(sub => sub.address);
    }

    async listSubscriptions(address: string): Promise<NotificationSubscription[]> {
        const subscriber = await this._model
            .findOne({ address })
            .populate('subscriptions')
            .exec();

        if (!subscriber) return [];

        return subscriber.subscriptions as SubscriptionSchema[];
    }

    async addSubscription(address: string, subscriptionId: string): Promise<Response<NotificationSubscriber>> {
        let subscriber = await this._model
            .findOne({ address })
            .exec();

        if (!subscriber) {
            subscriber = new this._model({
                address,
                subscriptions: [],
                subscriptionsLimit: DEFAULT_SUBSCRIPTIONS_LIMIT
            });
        }

        if (subscriber.subscriptions.indexOf(subscriptionId) !== -1) {
            return { errorMessage: '?????????? ???????????????? ?????? ????????????????????' };
        }

        subscriber.subscriptions.push(subscriptionId);
        await subscriber.save();

        return { result: subscriber };
    }

    async removeSubscription(address: string, subscriptionId: string): Promise<Response<NotificationSubscriber>> {
        const subscriber = await this._model
            .findOne({ address })
            .exec();

        if (!subscriber || subscriber.subscriptions.length === 0) {
            return { errorMessage: '???? ?????????? ???????????????? ???? ??????????????' };
        }

        if (subscriber.subscriptions.indexOf(subscriptionId) === -1) {
            return { errorMessage: '?? ?????? ?????? ?????????? ????????????????' };
        }

        subscriber.subscriptions = subscriber.subscriptions.filter(sub => sub !== subscriptionId);
        await subscriber.save();

        return { result: subscriber };
    }

    async removeSubscriber(address: string): Promise<void> {
        await this._model.deleteOne({ address }).exec();
    }
}