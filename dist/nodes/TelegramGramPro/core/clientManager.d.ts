import { TelegramClient } from 'teleproto';
export type ClientPurpose = 'trigger' | 'operation';
type GetClientOptions = {
    receiveUpdates?: boolean;
    cacheClient?: boolean;
    verifyAuthorization?: boolean;
    autoReconnect?: boolean;
};
export declare function getClient(apiId: number | string, apiHash: string, session: string, options?: GetClientOptions, purpose?: ClientPurpose): Promise<TelegramClient>;
export declare function disconnectClient(apiId: number, session: string, purpose?: ClientPurpose): Promise<void>;
export declare function cleanupAllClients(): Promise<void>;
export declare function markClientActive(apiId: number | string, session: string): void;
export declare function markClientIdle(apiId: number | string, session: string): void;
export declare function ensureConnected(apiId: number | string, apiHash: string, session: string): Promise<TelegramClient>;
export {};
