"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheKeys = exports.cache = exports.CacheManager = void 0;
class CacheManager {
    constructor() {
        this.cache = new Map();
        this.maxSize = 1000;
        this.defaultTTL = 5 * 60 * 1000;
    }
    static getInstance() {
        if (!CacheManager._instance) {
            if (!CacheManager._lock) {
                CacheManager._lock = true;
                if (!CacheManager._instance) {
                    CacheManager._instance = new CacheManager();
                }
                CacheManager._lock = false;
            }
            else {
                while (CacheManager._lock) {
                }
                if (!CacheManager._instance) {
                    throw new Error('Failed to initialize CacheManager instance');
                }
            }
        }
        return CacheManager._instance;
    }
    set(key, value, ttl = this.defaultTTL) {
        if (this.cache.size >= this.maxSize) {
            this.cleanup();
        }
        this.cache.set(key, {
            data: value,
            timestamp: Date.now(),
            ttl,
        });
    }
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }
    has(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return false;
        }
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }
    delete(key) {
        return this.cache.delete(key);
    }
    clear() {
        this.cache.clear();
    }
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
        };
    }
    cleanup() {
        const now = Date.now();
        const keysToDelete = [];
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                keysToDelete.push(key);
            }
        }
        for (const key of keysToDelete) {
            this.cache.delete(key);
        }
    }
    setMaxSize(size) {
        this.maxSize = size;
        if (this.cache.size > this.maxSize) {
            this.cleanup();
        }
    }
    setDefaultTTL(ttl) {
        this.defaultTTL = ttl;
    }
}
exports.CacheManager = CacheManager;
CacheManager._instance = null;
CacheManager._lock = false;
exports.cache = CacheManager.getInstance();
class CacheKeys {
    static getUser(userId) {
        return `user:${userId}`;
    }
    static getChat(chatId) {
        return `chat:${chatId}`;
    }
    static getChannel(channelId) {
        return `channel:${channelId}`;
    }
    static getChatMembers(channelId, limit) {
        return `chatMembers:${channelId}:${limit}`;
    }
    static getDialogs(limit) {
        return `dialogs:${limit}`;
    }
}
exports.CacheKeys = CacheKeys;
//# sourceMappingURL=cache.js.map