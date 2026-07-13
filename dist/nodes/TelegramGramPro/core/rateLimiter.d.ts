export declare class RateLimiter {
    private static _instance;
    private static _lock;
    private requestQueue;
    private isProcessing;
    private lastRequestTime;
    private minInterval;
    private maxQueueSize;
    private constructor();
    static getInstance(): RateLimiter;
    execute<T>(fn: () => Promise<T>, priority?: boolean): Promise<T>;
    private processQueue;
    setMinInterval(interval: number): void;
    getQueueLength(): number;
    clearQueue(): void;
}
export declare function withRateLimit<T>(fn: () => Promise<T>): Promise<T>;
