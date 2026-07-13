"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = void 0;
exports.withRateLimit = withRateLimit;
const logger_1 = require("./logger");
class RateLimiter {
    constructor() {
        this.requestQueue = [];
        this.isProcessing = false;
        this.lastRequestTime = 0;
        this.minInterval = 1000;
        this.maxQueueSize = 1000;
    }
    static getInstance() {
        if (!RateLimiter._instance) {
            if (!RateLimiter._lock) {
                RateLimiter._lock = true;
                if (!RateLimiter._instance) {
                    RateLimiter._instance = new RateLimiter();
                }
                RateLimiter._lock = false;
            }
            else {
                while (RateLimiter._lock) {
                }
                if (!RateLimiter._instance) {
                    throw new Error('Failed to initialize RateLimiter instance');
                }
            }
        }
        return RateLimiter._instance;
    }
    async execute(fn, priority = false) {
        if (this.requestQueue.length >= this.maxQueueSize) {
            throw new Error('Rate limiter queue is full. Please try again later.');
        }
        return new Promise((resolve, reject) => {
            const request = { fn, resolve, reject };
            if (priority) {
                this.requestQueue.unshift(request);
            }
            else {
                this.requestQueue.push(request);
            }
            this.processQueue();
        });
    }
    async processQueue() {
        if (this.isProcessing) {
            return;
        }
        this.isProcessing = true;
        while (this.requestQueue.length > 0) {
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;
            if (timeSinceLastRequest < this.minInterval) {
                const waitTime = this.minInterval - timeSinceLastRequest;
                logger_1.logger.debug(`Rate limiting: waiting ${waitTime}ms before next request`);
                await new Promise((resolve) => setTimeout(resolve, waitTime));
            }
            const request = this.requestQueue.shift();
            if (!request)
                break;
            try {
                this.lastRequestTime = Date.now();
                const result = await request.fn();
                request.resolve(result);
            }
            catch (error) {
                logger_1.logger.error('Rate limiter error', {
                    error: error instanceof Error ? error.message : String(error),
                });
                request.reject(error);
            }
        }
        this.isProcessing = false;
    }
    setMinInterval(interval) {
        if (interval < 100) {
            logger_1.logger.warn('Minimum interval cannot be less than 100ms, using 100ms');
            this.minInterval = 100;
        }
        else {
            this.minInterval = interval;
        }
    }
    getQueueLength() {
        return this.requestQueue.length;
    }
    clearQueue() {
        this.requestQueue.forEach((request) => {
            request.reject(new Error('Request cancelled due to queue clear'));
        });
        this.requestQueue = [];
    }
}
exports.RateLimiter = RateLimiter;
RateLimiter._instance = null;
RateLimiter._lock = false;
async function withRateLimit(fn) {
    const rateLimiter = RateLimiter.getInstance();
    return rateLimiter.execute(fn);
}
//# sourceMappingURL=rateLimiter.js.map