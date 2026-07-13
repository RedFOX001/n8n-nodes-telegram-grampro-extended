"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseFormatter = exports.ParameterExtractor = exports.BaseOperation = void 0;
exports.chunk = chunk;
const clientManager_1 = require("./clientManager");
const floodWaitHandler_1 = require("./floodWaitHandler");
const rateLimiter_1 = require("./rateLimiter");
function chunk(items, size) {
    if (size <= 0)
        return [items];
    const result = [];
    for (let index = 0; index < items.length; index += size) {
        result.push(items.slice(index, index + size));
    }
    return result;
}
class BaseOperation {
    constructor(context, operation) {
        this.context = context;
        this.operation = operation;
    }
    async initializeClient() {
        const creds = (await this.context.getCredentials('telegramGramProApi'));
        if (!creds) {
            throw new Error('No Telegram credentials found');
        }
        const client = await (0, clientManager_1.getClient)(creds.apiId, creds.apiHash, creds.session);
        if (!client) {
            throw new Error('Failed to initialize Telegram client');
        }
        this.client = client;
    }
    async executeWithRateLimit(fn) {
        return await (0, rateLimiter_1.withRateLimit)(() => (0, floodWaitHandler_1.safeExecute)(fn));
    }
    getParameter(name, index = 0) {
        return this.context.getNodeParameter(name, index);
    }
    getStringParameter(name, index = 0) {
        return this.getParameter(name, index);
    }
    getNumberParameter(name, index = 0) {
        return this.getParameter(name, index);
    }
    getBooleanParameter(name, index = 0) {
        return this.getParameter(name, index);
    }
    getArrayParameter(name, index = 0) {
        return this.getParameter(name, index);
    }
    async validateParameters() {
    }
    async run() {
        await this.initializeClient();
        await this.validateParameters();
        return await this.execute();
    }
}
exports.BaseOperation = BaseOperation;
class ParameterExtractor {
    static extractMessageParams(context, index = 0) {
        return {
            chatId: context.getNodeParameter('chatId', index),
            text: context.getNodeParameter('text', index, ''),
            messageId: context.getNodeParameter('messageId', index, 0),
            replyTo: context.getNodeParameter('replyTo', index),
            noWebpage: context.getNodeParameter('noWebpage', index, false),
            silent: context.getNodeParameter('silent', index, false),
        };
    }
    static extractChatParams(context, index = 0) {
        return {
            chatId: context.getNodeParameter('chatId', index),
            title: context.getNodeParameter('title', index),
            about: context.getNodeParameter('about', index, ''),
            users: context.getNodeParameter('users', index, []),
        };
    }
    static extractUserParams(context, index = 0) {
        return {
            userId: context.getNodeParameter('userId', index),
            username: context.getNodeParameter('username', index),
            firstName: context.getNodeParameter('firstName', index),
            lastName: context.getNodeParameter('lastName', index),
            bio: context.getNodeParameter('bio', index),
        };
    }
    static extractMediaParams(context, index = 0) {
        return {
            chatId: context.getNodeParameter('chatId', index),
            messageId: context.getNodeParameter('messageId', index),
            media: context.getNodeParameter('media', index),
            caption: context.getNodeParameter('caption', index, ''),
        };
    }
}
exports.ParameterExtractor = ParameterExtractor;
class ResponseFormatter {
    static success(data, metadata) {
        return [
            {
                json: {
                    success: true,
                    ...data,
                    ...(metadata !== undefined ? { metadata } : {}),
                },
            },
        ];
    }
    static error(message, error) {
        const details = error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : error;
        return [
            {
                json: {
                    success: false,
                    error: message,
                    ...(details !== undefined ? { details } : {}),
                },
            },
        ];
    }
    static messageResult(message) {
        var _a, _b;
        return ResponseFormatter.success({
            id: message.id,
            text: ((_a = message.text) !== null && _a !== void 0 ? _a : message.message),
            rawText: ((_b = message.rawText) !== null && _b !== void 0 ? _b : message.message),
            date: message.date,
            chatId: message.chatId,
            fromId: message.fromId,
        });
    }
    static userResult(user) {
        return ResponseFormatter.success({
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            isBot: user.bot,
            isVerified: user.verified,
            bio: user.bio,
        });
    }
    static chatResult(chat) {
        return ResponseFormatter.success({
            id: chat.id,
            title: chat.title,
            username: chat.username,
            type: chat.className,
            participantsCount: chat.participantsCount,
        });
    }
}
exports.ResponseFormatter = ResponseFormatter;
//# sourceMappingURL=operationHelpers.js.map