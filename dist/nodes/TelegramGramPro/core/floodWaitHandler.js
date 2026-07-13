"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeExecute = safeExecute;
const logger_1 = require("./logger");
const nodeOperationError_1 = require("./nodeOperationError");
const telegramErrorMapper_1 = require("./telegramErrorMapper");
async function safeExecute(fn) {
    var _a, _b;
    let retryCount = 0;
    const maxRetries = 5;
    const baseDelay = 1000;
    const asError = (err) => (err instanceof Error ? err : new Error(String(err)));
    while (true) {
        try {
            return await fn();
        }
        catch (err) {
            retryCount++;
            const error = asError(err);
            const mappedError = (0, telegramErrorMapper_1.mapTelegramError)(err);
            if (mappedError.code === 'FLOOD_WAIT') {
                const seconds = (_a = mappedError.retryAfterSeconds) !== null && _a !== void 0 ? _a : 60;
                if (retryCount <= maxRetries) {
                    logger_1.logger.warn(`${mappedError.userMessage} (retry ${retryCount}/${maxRetries})`);
                    await new Promise((r) => setTimeout(r, seconds * 1000));
                    continue;
                }
                logger_1.logger.error('Max retries exceeded for FLOOD_WAIT');
                throw (0, nodeOperationError_1.createNodeOperationError)(`${mappedError.userMessage} Max retries (${maxRetries}) exceeded.`, { cause: err });
            }
            if (mappedError.code === 'AUTH_KEY_DUPLICATED') {
                logger_1.logger.error(mappedError.userMessage);
                throw (0, nodeOperationError_1.createNodeOperationError)(mappedError.userMessage, { cause: err });
            }
            if (mappedError.code === 'AUTH_KEY_UNREGISTERED') {
                logger_1.logger.error(mappedError.userMessage);
                throw (0, nodeOperationError_1.createNodeOperationError)(mappedError.userMessage, { cause: err });
            }
            if (mappedError.code === 'SESSION_REVOKED' || mappedError.code === 'SESSION_EXPIRED') {
                logger_1.logger.error(mappedError.userMessage);
                throw (0, nodeOperationError_1.createNodeOperationError)(mappedError.userMessage, { cause: err });
            }
            if (mappedError.code === 'SESSION_PASSWORD_NEEDED') {
                throw (0, nodeOperationError_1.asNodeOperationError)(error);
            }
            if (mappedError.code === 'PHONE_CODE_INVALID' || mappedError.code === 'PHONE_CODE_EXPIRED') {
                logger_1.logger.error(mappedError.userMessage);
                throw (0, nodeOperationError_1.createNodeOperationError)(mappedError.userMessage, { cause: err });
            }
            if (mappedError.code === 'USER_DEACTIVATED_BAN') {
                logger_1.logger.error(mappedError.userMessage);
                throw (0, nodeOperationError_1.createNodeOperationError)(mappedError.userMessage, { cause: err });
            }
            if (mappedError.code === 'PEER_FLOOD') {
                const seconds = (_b = mappedError.retryAfterSeconds) !== null && _b !== void 0 ? _b : 60;
                if (retryCount <= maxRetries) {
                    logger_1.logger.warn(`${mappedError.userMessage} (retry ${retryCount}/${maxRetries})`);
                    await new Promise((r) => setTimeout(r, seconds * 1000));
                    continue;
                }
                logger_1.logger.error('Max retries exceeded for PEER_FLOOD');
                throw (0, nodeOperationError_1.createNodeOperationError)(`${mappedError.userMessage} Max retries (${maxRetries}) exceeded.`, { cause: err });
            }
            if (mappedError.code === 'NETWORK_TIMEOUT') {
                if (retryCount <= maxRetries) {
                    const delay = baseDelay * Math.pow(2, retryCount - 1);
                    logger_1.logger.warn(`${mappedError.userMessage} Retrying in ${delay}ms (retry ${retryCount}/${maxRetries})`);
                    await new Promise((r) => setTimeout(r, delay));
                    continue;
                }
                else {
                    logger_1.logger.error('Max retries exceeded for network timeout');
                    throw (0, nodeOperationError_1.createNodeOperationError)('Network timeout after multiple retries', {
                        cause: err,
                    });
                }
            }
            if (mappedError.code === 'CHAT_WRITE_FORBIDDEN') {
                logger_1.logger.error(mappedError.userMessage);
                throw (0, nodeOperationError_1.createNodeOperationError)(mappedError.userMessage, { cause: err });
            }
            if (mappedError.code === 'USER_BANNED_IN_CHANNEL') {
                logger_1.logger.error(mappedError.userMessage);
                throw (0, nodeOperationError_1.createNodeOperationError)(mappedError.userMessage, { cause: err });
            }
            if (mappedError.code === 'INPUT_USER_DEACTIVATED') {
                logger_1.logger.error(mappedError.userMessage);
                throw (0, nodeOperationError_1.createNodeOperationError)(mappedError.userMessage, { cause: err });
            }
            if (mappedError.retryable && retryCount <= maxRetries) {
                const delay = baseDelay * Math.pow(2, retryCount - 1);
                logger_1.logger.warn(`Retryable error: retrying in ${delay}ms (retry ${retryCount}/${maxRetries}) - Error: ${error.message}`);
                await new Promise((r) => setTimeout(r, delay));
                continue;
            }
            logger_1.logger.error(`Failed without retry: ${mappedError.userMessage}`);
            throw (0, nodeOperationError_1.createNodeOperationError)(mappedError.userMessage, { cause: err });
        }
    }
}
//# sourceMappingURL=floodWaitHandler.js.map