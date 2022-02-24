import { ClientCredentialsAuthProvider } from '@twurple/auth';
import { ApiClient } from '@twurple/api';
import { EnvPortAdapter, EventSubListener } from '@twurple/eventsub';
import { NgrokAdapter } from '@twurple/eventsub-ngrok';

import { EventObserver } from "../types";


export type TwitchEvent = 'live' | 'update';

export class TwitchObserver implements EventObserver<TwitchEvent> {
    protected _apiClient: ApiClient;
    protected _listener: EventSubListener;

    constructor() {
        const { TWITCH_CLIENT_ID,
            TWITCH_CLIENT_SECRET,
            TWITCH_SUBSCRIPTION_SECRET,
            HOST_NAME,
            NODE_ENV } = process.env;

        const authProvider = new ClientCredentialsAuthProvider(
            String(TWITCH_CLIENT_ID),
            String(TWITCH_CLIENT_SECRET)
        );
        const apiClient = new ApiClient({
            authProvider,
            logger: {
                minLevel: NODE_ENV === 'development' ? 'debug' : 'error'
            }
        });
        const adapter = NODE_ENV === 'development'
            ? new NgrokAdapter()
            // Необходимо следить за лимитом подписок, так как ngrok использует новые хосты после перезапуска
            : new EnvPortAdapter({
                hostName: String(HOST_NAME)
            });;
        const secret = String(TWITCH_SUBSCRIPTION_SECRET);

        this._apiClient = apiClient;
        this._listener = new EventSubListener({ apiClient, adapter, secret });
    }

    async subscribe(event: TwitchEvent): Promise<void> {

    }

    async unsubscribe(eventId: string): Promise<void> {
        await this._apiClient.eventSub.deleteSubscription(eventId);
    }

    async start(): Promise<void> {
        await this._listener.listen();

        // await this._apiClient.eventSub.deleteAllSubscriptions();
    }
}