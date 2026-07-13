export declare class CacheManager {
    private cache;
    private maxSize;
    private defaultTTL;
    private static _instance;
    private static _lock;
    private constructor();
    static getInstance(): CacheManager;
    set<T>(key: string, value: T, ttl?: number): void;
    get<T>(key: string): T | null;
    has(key: string): boolean;
    delete(key: string): boolean;
    clear(): void;
    getStats(): {
        size: number;
        maxSize: number;
    };
    private cleanup;
    setMaxSize(size: number): void;
    setDefaultTTL(ttl: number): void;
}
export declare const cache: CacheManager;
export declare class CacheKeys {
    static getUser(userId: string): string;
    static getChat(chatId: string): string;
    static getChannel(channelId: string): string;
    static getChatMembers(channelId: string, limit: number): string;
    static getDialogs(limit: number): string;
}
