"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClient = getClient;
exports.disconnectClient = disconnectClient;
exports.cleanupAllClients = cleanupAllClients;
exports.markClientActive = markClientActive;
exports.markClientIdle = markClientIdle;
exports.ensureConnected = ensureConnected;
const teleproto_1 = require("teleproto");
const sessions_1 = require("teleproto/sessions");
const Logger_1 = require("teleproto/extensions/Logger");
const logger_1 = require("./logger");
const nodeOperationError_1 = require("./nodeOperationError");
const sessionEncryption_1 = require("./sessionEncryption");
const crypto = __importStar(require("crypto"));
const clients = new Map();
const connectionLocks = new Map();
const connectionTimestamps = new Map();
const clientLastUsed = new Map();
const activeOperations = new Map();
const CLEANUP_INTERVAL = 1 * 60 * 1000;
const MAX_CONNECTION_AGE = 30 * 60 * 1000;
const MAX_IDLE_AGE = 30 * 1000;
setInterval(() => {
    cleanupStaleConnections();
}, CLEANUP_INTERVAL);
function cleanupStaleConnections() {
    var _a, _b;
    const now = Date.now();
    for (const [key, timestamp] of connectionTimestamps.entries()) {
        if (now - timestamp > MAX_CONNECTION_AGE) {
            connectionLocks.delete(key);
            connectionTimestamps.delete(key);
            logger_1.logger.debug(`[ClientManager] Cleaned up stale connection lock: ${key}`);
        }
    }
    for (const [key, client] of clients.entries()) {
        const lastUsed = (_a = clientLastUsed.get(key)) !== null && _a !== void 0 ? _a : 0;
        const isIdle = now - lastUsed > MAX_IDLE_AGE;
        const hasEventHandlers = client.listEventHandlers().length > 0;
        const hasActiveOps = ((_b = activeOperations.get(key)) !== null && _b !== void 0 ? _b : 0) > 0;
        if (isIdle && !hasEventHandlers && !hasActiveOps && !isDestroyedClient(client)) {
            logger_1.logger.info(`[ClientManager] Auto-disconnecting idle client (no event handlers, idle ${Math.round((now - lastUsed) / 1000)}s): ${key}`);
            gracefulDestroy(client).catch(() => { });
            clients.delete(key);
            clientLastUsed.delete(key);
        }
    }
}
function buildClientKey(apiId, session) {
    return `${apiId}:${session.length > 20 ? session.substring(0, 20) : session}:${session.slice(-10)}`;
}
function isDestroyedClient(client) {
    return Boolean(client._destroyed);
}
async function verifyClientAuthorization(client, receiveUpdates) {
    if (receiveUpdates) {
        await client.getMe();
        return;
    }
    const authorized = await client.checkAuthorization();
    if (!authorized) {
        throw (0, nodeOperationError_1.createNodeOperationError)('Telegram client is not authorized.');
    }
}
async function prepareConnectedClient(client, options) {
    var _a;
    if (options.receiveUpdates) {
        await ((_a = client.catchUp) === null || _a === void 0 ? void 0 : _a.call(client));
    }
    if (options.verifyAuthorization) {
        await verifyClientAuthorization(client, options.receiveUpdates);
    }
}
async function getClient(apiId, apiHash, session, options = {}, purpose = 'operation') {
    var _a, _b, _c, _d, _e, _f;
    const numericApiId = typeof apiId === 'string' ? parseInt(apiId, 10) : apiId;
    const receiveUpdates = (_a = options.receiveUpdates) !== null && _a !== void 0 ? _a : false;
    const cacheClient = (_b = options.cacheClient) !== null && _b !== void 0 ? _b : true;
    const verifyAuthorization = (_c = options.verifyAuthorization) !== null && _c !== void 0 ? _c : true;
    const autoReconnect = (_d = options.autoReconnect) !== null && _d !== void 0 ? _d : true;
    const key = buildClientKey(numericApiId, session);
    const existingLock = cacheClient ? connectionLocks.get(key) : undefined;
    if (existingLock) {
        logger_1.logger.debug(`[ClientManager] [${purpose}] Waiting for existing connection lock for ${numericApiId}...`);
        return await existingLock;
    }
    if (cacheClient && clients.has(key)) {
        const existingClient = clients.get(key);
        if (isDestroyedClient(existingClient)) {
            logger_1.logger.warn(`[ClientManager] [${purpose}] Client ${numericApiId} is destroyed. Recreating cached client.`);
            clients.delete(key);
            clientLastUsed.delete(key);
        }
        else {
            const lastUsed = (_e = clientLastUsed.get(key)) !== null && _e !== void 0 ? _e : 0;
            const isIdle = Date.now() - lastUsed >= MAX_IDLE_AGE;
            const hasEventHandlers = existingClient.listEventHandlers().length > 0;
            const hasActiveOps = ((_f = activeOperations.get(key)) !== null && _f !== void 0 ? _f : 0) > 0;
            if (isIdle && !hasEventHandlers && !hasActiveOps) {
                logger_1.logger.info(`[ClientManager] [${purpose}] Client ${numericApiId} is idle (${Math.round((Date.now() - lastUsed) / 1000)}s) with no event handlers. Destroying and creating fresh client.`);
                await gracefulDestroy(existingClient);
                clients.delete(key);
                clientLastUsed.delete(key);
            }
            else if (existingClient.connected) {
                clientLastUsed.set(key, Date.now());
                await prepareConnectedClient(existingClient, {
                    receiveUpdates,
                    verifyAuthorization,
                });
                logger_1.logger.debug(`[ClientManager] [${purpose}] Reusing existing connected client for ${numericApiId}`);
                return existingClient;
            }
            else {
                logger_1.logger.warn(`[ClientManager] [${purpose}] Client ${numericApiId} found but disconnected. Attempting heal...`);
                try {
                    await existingClient.connect();
                    await prepareConnectedClient(existingClient, {
                        receiveUpdates,
                        verifyAuthorization,
                    });
                    clientLastUsed.set(key, Date.now());
                    return existingClient;
                }
                catch {
                    logger_1.logger.error(`[ClientManager] [${purpose}] Heal failed for ${numericApiId}. Destroying and recreating.`);
                    await gracefulDestroy(existingClient);
                    clients.delete(key);
                    clientLastUsed.delete(key);
                }
            }
        }
    }
    const connectPromise = (async () => {
        logger_1.logger.info(`[ClientManager] [${purpose}] Initializing new client for ${numericApiId} (receiveUpdates=${receiveUpdates}, cacheClient=${cacheClient})...`);
        let decryptedSession = session;
        if (sessionEncryption_1.SessionEncryption.isEncryptedSession(session)) {
            try {
                const combined = `${numericApiId}:${apiHash}`;
                const encryptionKey = crypto
                    .createHash('sha256')
                    .update(combined)
                    .digest('hex')
                    .substring(0, 32);
                decryptedSession = sessionEncryption_1.SessionEncryption.decryptSession(session, encryptionKey);
                logger_1.logger.debug(`[ClientManager] [${purpose}] Session decrypted successfully for ${numericApiId}`);
            }
            catch (error) {
                logger_1.logger.error(`[ClientManager] [${purpose}] Session decryption failed for ${numericApiId}: ${error}`);
                const message = error instanceof Error ? error.message : String(error);
                throw (0, nodeOperationError_1.createNodeOperationError)(`Session decryption failed: ${message}`, { cause: error });
            }
        }
        const stringSession = new sessions_1.StringSession(decryptedSession);
        const client = new teleproto_1.TelegramClient(stringSession, numericApiId, apiHash, {
            connectionRetries: 5,
            autoReconnect,
        });
        client.setLogLevel(Logger_1.LogLevel.ERROR);
        try {
            await client.connect();
            await prepareConnectedClient(client, {
                receiveUpdates,
                verifyAuthorization,
            });
            logger_1.logger.info(`[ClientManager] [${purpose}] Connection established for ${numericApiId}`);
            if (cacheClient) {
                clients.set(key, client);
                clientLastUsed.set(key, Date.now());
            }
            return client;
        }
        catch (error) {
            logger_1.logger.error(`[ClientManager] [${purpose}] Connection failed for ${numericApiId}: ${error}`);
            await gracefulDestroy(client);
            throw (0, nodeOperationError_1.asNodeOperationError)(error);
        }
        finally {
            connectionLocks.delete(key);
            connectionTimestamps.delete(key);
        }
    })();
    if (cacheClient) {
        connectionLocks.set(key, connectPromise);
        connectionTimestamps.set(key, Date.now());
    }
    return await connectPromise;
}
async function gracefulDestroy(client) {
    try {
        await client.disconnect();
        await client.destroy();
    }
    catch {
    }
}
async function disconnectClient(apiId, session, purpose = 'operation') {
    const key = buildClientKey(apiId, session);
    if (clients.has(key)) {
        const client = clients.get(key);
        await gracefulDestroy(client);
        clients.delete(key);
        logger_1.logger.info(`[ClientManager] [${purpose}] Manually disconnected client: ${apiId}`);
    }
}
async function cleanupAllClients() {
    logger_1.logger.info('[ClientManager] Cleaning up all Telegram clients...');
    const promises = [];
    for (const client of clients.values()) {
        promises.push(gracefulDestroy(client));
    }
    await Promise.all(promises);
    clients.clear();
    connectionLocks.clear();
    connectionTimestamps.clear();
    clientLastUsed.clear();
    activeOperations.clear();
    logger_1.logger.info('[ClientManager] Cleanup complete.');
}
function markClientActive(apiId, session) {
    var _a;
    const numericApiId = typeof apiId === 'string' ? parseInt(apiId, 10) : apiId;
    const key = buildClientKey(numericApiId, session);
    activeOperations.set(key, ((_a = activeOperations.get(key)) !== null && _a !== void 0 ? _a : 0) + 1);
    clientLastUsed.set(key, Date.now());
    logger_1.logger.debug(`[ClientManager] Client marked active (ops=${activeOperations.get(key)}): ${numericApiId}`);
}
function markClientIdle(apiId, session) {
    var _a, _b;
    const numericApiId = typeof apiId === 'string' ? parseInt(apiId, 10) : apiId;
    const key = buildClientKey(numericApiId, session);
    const current = (_a = activeOperations.get(key)) !== null && _a !== void 0 ? _a : 0;
    if (current <= 1) {
        activeOperations.delete(key);
    }
    else {
        activeOperations.set(key, current - 1);
    }
    clientLastUsed.set(key, Date.now());
    logger_1.logger.debug(`[ClientManager] Client marked idle (ops=${(_b = activeOperations.get(key)) !== null && _b !== void 0 ? _b : 0}): ${numericApiId}`);
}
async function ensureConnected(apiId, apiHash, session) {
    const numericApiId = typeof apiId === 'string' ? parseInt(apiId, 10) : apiId;
    const key = buildClientKey(numericApiId, session);
    const existing = clients.get(key);
    if (existing && !isDestroyedClient(existing) && existing.connected) {
        clientLastUsed.set(key, Date.now());
        return existing;
    }
    logger_1.logger.warn(`[ClientManager] Client was disconnected during operation, reconnecting...`);
    return getClient(numericApiId, apiHash, session);
}
//# sourceMappingURL=clientManager.js.map