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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageRouter = messageRouter;
exports.resolvePeer = resolvePeer;
exports.enrichHistoryStats = enrichHistoryStats;
const clientManager_1 = require("../core/clientManager");
const floodWaitHandler_1 = require("../core/floodWaitHandler");
const rateLimiter_1 = require("../core/rateLimiter");
const teleproto_1 = require("teleproto");
const big_integer_1 = __importDefault(require("big-integer"));
const uploads_1 = require("teleproto/client/uploads");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = __importDefault(require("path"));
const stream_1 = require("stream");
const promises_2 = require("stream/promises");
const logger_1 = require("../core/logger");
const messageFormatting_1 = require("../core/messageFormatting");
const nodeOperationError_1 = require("../core/nodeOperationError");
const operationHelpers_1 = require("../core/operationHelpers");
const payloadBuilders_1 = require("../core/payloadBuilders");
const URL_MEDIA_DOWNLOAD_TIMEOUT_MS = 30 * 60 * 1000;
function toIdString(value) {
    if (value === undefined) {
        return undefined;
    }
    return value.toString();
}
function toBigIntValue(value, fallback = 0) {
    return (0, big_integer_1.default)(value !== undefined ? value.toString() : fallback.toString());
}
function toBytes(value) {
    return value ? Buffer.from(value) : Buffer.alloc(0);
}
function getPeerIdString(peer) {
    return (toIdString(peer === null || peer === void 0 ? void 0 : peer.userId) ||
        toIdString(peer === null || peer === void 0 ? void 0 : peer.chatId) ||
        toIdString(peer === null || peer === void 0 ? void 0 : peer.channelId) ||
        toIdString(peer === null || peer === void 0 ? void 0 : peer.user_id) ||
        toIdString(peer === null || peer === void 0 ? void 0 : peer.chat_id) ||
        toIdString(peer === null || peer === void 0 ? void 0 : peer.channel_id) ||
        ((peer === null || peer === void 0 ? void 0 : peer.toString) ? peer.toString() : null) ||
        null);
}
function getMessageText(message, fallback = '') {
    var _a, _b, _c;
    return (_c = (_b = (_a = message === null || message === void 0 ? void 0 : message.message) !== null && _a !== void 0 ? _a : message === null || message === void 0 ? void 0 : message.text) !== null && _b !== void 0 ? _b : message === null || message === void 0 ? void 0 : message.caption) !== null && _c !== void 0 ? _c : fallback;
}
function getRichMessageText(message, fallback = '') {
    const text = getMessageText(message, fallback);
    return (0, messageFormatting_1.renderTelegramEntities)(text, normalizeMessageEntities(message === null || message === void 0 ? void 0 : message.entities));
}
function normalizeMessageEntities(entities) {
    if (!Array.isArray(entities)) {
        return [];
    }
    return entities.filter((entity) => typeof entity === 'object' && entity !== null);
}
function getEntityLabel(entity) {
    if (!entity) {
        return 'Unknown';
    }
    if (entity.title) {
        return entity.title;
    }
    const fullName = [entity.firstName, entity.lastName].filter(Boolean).join(' ');
    if (fullName) {
        return fullName;
    }
    return entity.username || 'Unknown';
}
function getFormattedEntityId(entity, fallback) {
    const rawId = toIdString(entity === null || entity === void 0 ? void 0 : entity.id);
    if (!rawId) {
        return fallback;
    }
    if ((entity === null || entity === void 0 ? void 0 : entity.className) === 'Channel' || (entity === null || entity === void 0 ? void 0 : entity._) === 'channel') {
        return `-100${rawId}`;
    }
    if ((entity === null || entity === void 0 ? void 0 : entity.className) === 'Chat' || (entity === null || entity === void 0 ? void 0 : entity._) === 'chat') {
        return `-${rawId}`;
    }
    return rawId;
}
function isResolvablePeerObject(value) {
    return typeof value === 'object' && value !== null;
}
function normalizePeerReference(rawId) {
    if (typeof rawId !== 'string') {
        return rawId;
    }
    let normalized = rawId.trim();
    if (!normalized) {
        return normalized;
    }
    const topicMatch = normalized.match(/(?:https?:\/\/)?t\.me\/(?:c\/)?([a-zA-Z0-9_-]+)(?:\/\d+)?\/?$/i);
    if (topicMatch) {
        normalized = topicMatch[1];
    }
    if (/^\d+$/.test(normalized)) {
        return normalized;
    }
    return normalized;
}
function getInputReferenceAliases(rawId) {
    const trimmed = rawId.trim();
    if (!trimmed) {
        return [];
    }
    const aliases = new Set([trimmed]);
    if (trimmed.startsWith('@')) {
        aliases.add(trimmed.slice(1));
    }
    else if (/^[a-zA-Z][a-zA-Z0-9_]{2,}$/.test(trimmed)) {
        aliases.add(`@${trimmed}`);
    }
    if (/^-100\d+$/.test(trimmed)) {
        aliases.add(trimmed.slice(4));
    }
    else if (/^-\d+$/.test(trimmed)) {
        aliases.add(trimmed.slice(1));
    }
    else if (/^\d+$/.test(trimmed)) {
        aliases.add(`-${trimmed}`);
        aliases.add(`-100${trimmed}`);
    }
    return Array.from(aliases);
}
function getEntityReferenceAliases(entity) {
    const aliases = new Set();
    const rawId = toIdString(entity.id);
    if (rawId) {
        aliases.add(rawId);
        if (entity.className === 'Channel' || entity._ === 'channel') {
            aliases.add(`-100${rawId}`);
        }
        if (entity.className === 'Chat' || entity._ === 'chat') {
            aliases.add(`-${rawId}`);
        }
    }
    if (typeof entity.username === 'string' && entity.username.trim()) {
        aliases.add(entity.username.trim().toLowerCase());
        aliases.add(`@${entity.username.trim().toLowerCase()}`);
    }
    return aliases;
}
function matchesEntityReference(entity, rawReference) {
    const inputAliases = getInputReferenceAliases(rawReference).map((candidate) => candidate.toLowerCase());
    const entityAliases = getEntityReferenceAliases(entity);
    return inputAliases.some((candidate) => entityAliases.has(candidate));
}
function isChannelEntity(entity) {
    return !!entity && (entity.className === 'Channel' || entity._ === 'channel');
}
function isChatEntity(entity) {
    return !!entity && (entity.className === 'Chat' || entity._ === 'chat');
}
function detectPeerKind(entity, peer) {
    if (isChannelEntity(entity))
        return 'channel';
    if (isChatEntity(entity))
        return 'chat';
    if (entity && (entity.className === 'User' || entity._ === 'user'))
        return 'user';
    const candidate = peer;
    if ((candidate === null || candidate === void 0 ? void 0 : candidate.channelId) !== undefined || (candidate === null || candidate === void 0 ? void 0 : candidate.channel_id) !== undefined)
        return 'channel';
    if ((candidate === null || candidate === void 0 ? void 0 : candidate.chatId) !== undefined || (candidate === null || candidate === void 0 ? void 0 : candidate.chat_id) !== undefined)
        return 'chat';
    if ((candidate === null || candidate === void 0 ? void 0 : candidate.userId) !== undefined || (candidate === null || candidate === void 0 ? void 0 : candidate.user_id) !== undefined)
        return 'user';
    return 'unknown';
}
function canDeleteHistoryForEveryone(entity) {
    if (!entity)
        return null;
    if (entity.creator)
        return true;
    const rights = entity.adminRights || entity.admin_rights;
    if (!rights)
        return false;
    return !!(rights.deleteMessages || rights.delete_messages);
}
function getRpcErrorCode(message) {
    const errorCodeMatch = message.match(/\b[A-Z_]{3,}\b/);
    return (errorCodeMatch === null || errorCodeMatch === void 0 ? void 0 : errorCodeMatch[0]) || 'DELETE_HISTORY_FAILED';
}
function isAdminRequiredErrorCode(errorCode) {
    return (errorCode === 'CHAT_ADMIN_REQUIRED' ||
        errorCode === 'RIGHT_FORBIDDEN' ||
        errorCode === 'MESSAGE_DELETE_FORBIDDEN');
}
function toInputChannel(channelLike) {
    var _a, _b, _c;
    const candidate = channelLike;
    if (!candidate) {
        return null;
    }
    const rawChannelId = (_b = (_a = candidate.channelId) !== null && _a !== void 0 ? _a : candidate.channel_id) !== null && _b !== void 0 ? _b : candidate.id;
    const rawAccessHash = (_c = candidate.accessHash) !== null && _c !== void 0 ? _c : candidate.access_hash;
    if (rawChannelId === undefined || rawAccessHash === undefined) {
        return null;
    }
    return new teleproto_1.Api.InputChannel({
        channelId: toBigIntValue(rawChannelId),
        accessHash: toBigIntValue(rawAccessHash),
    });
}
async function editMessageLoose(client, chatId, params) {
    return (await client.editMessage(chatId, params));
}
async function getMessagesLoose(client, peer, params) {
    const resolvedPeer = await resolvePeer(client, peer);
    return (await client.getMessages(resolvedPeer, params));
}
async function getEntityLoose(client, peer) {
    const resolvedPeer = await resolvePeer(client, peer);
    return (await client.getEntity(resolvedPeer));
}
async function sendMessageLoose(client, peer, params) {
    const resolvedPeer = await resolvePeer(client, peer);
    const result = (await client.sendMessage(resolvedPeer, params));
    return (Array.isArray(result) ? result[0] : result);
}
async function forwardMessagesLoose(client, peer, params) {
    const resolvedPeer = await resolvePeer(client, peer);
    const resolvedParams = { ...params };
    if ('fromPeer' in resolvedParams) {
        resolvedParams.fromPeer = await resolvePeer(client, resolvedParams.fromPeer);
    }
    const result = (await client.forwardMessages(resolvedPeer, resolvedParams));
    return (Array.isArray(result) ? result[0] : result);
}
async function* iterMessagesLoose(client, peer, params) {
    const resolvedPeer = await resolvePeer(client, peer);
    for await (const message of client.iterMessages(resolvedPeer, params)) {
        yield message;
    }
}
function iterDialogsLoose(client, params) {
    return client.iterDialogs(params);
}
async function downloadMediaLoose(client, target, params) {
    return await client.downloadMedia(target, params);
}
async function messageRouter(operation, i) {
    const creds = (await this.getCredentials('telegramGramProApi'));
    const client = await (0, clientManager_1.getClient)(creds.apiId, creds.apiHash, creds.session);
    switch (operation) {
        case 'sendText':
            return sendText.call(this, client, i, creds);
        case 'forwardMessage':
            return forwardMessage.call(this, client, i);
        case 'getHistory':
            return getHistory.call(this, client, i);
        case 'editMessage':
            return editMessage.call(this, client, i);
        case 'deleteMessage':
            return deleteMessage.call(this, client, i);
        case 'deleteHistory':
            return deleteHistory.call(this, client, i);
        case 'pinMessage':
            return pinMessage.call(this, client, i);
        case 'unpinMessage':
            return unpinMessage.call(this, client, i);
        case 'sendPoll':
            return sendPoll.call(this, client, i);
        case 'copyMessage':
            return copyMessage.call(this, client, i);
        case 'editMessageMedia':
            return editMessageMedia.call(this, client, i);
        case 'copyRestrictedContent':
            return copyRestrictedContent.call(this, client, i);
        case 'readHistory':
            return readHistory.call(this, client, i);
        default:
            throw new Error(`Message operation not supported: ${operation}`);
    }
}
async function editMessage(client, i) {
    var _a;
    const editFromSelf = this.getNodeParameter('editFromSelf', i, false);
    const chatId = editFromSelf ? 'me' : this.getNodeParameter('chatId', i);
    const messageId = Number(this.getNodeParameter('messageId', i));
    const textRaw = this.getNodeParameter('text', i);
    const text = typeof textRaw === 'string' ? textRaw : (textRaw !== null && textRaw !== void 0 ? textRaw : '').toString();
    const noWebpage = this.getNodeParameter('noWebpage', i);
    const formattedInput = (0, messageFormatting_1.prepareTelegramTextInput)(text);
    const result = await (0, floodWaitHandler_1.safeExecute)(() => editMessageLoose(client, chatId, {
        message: messageId,
        text: formattedInput.text,
        parseMode: formattedInput.parseMode,
        linkPreview: !noWebpage,
    }));
    let detailedMessage = null;
    try {
        const messages = await getMessagesLoose(client, chatId, { ids: [result.id] });
        if (messages && messages.length > 0) {
            detailedMessage = messages[0];
        }
    }
    catch (error) {
        logger_1.logger.warn('Failed to fetch detailed message info after edit: ' + error.message);
    }
    let sourceName = 'Unknown';
    let formattedSourceId = typeof chatId === 'string' ? chatId : '';
    try {
        const entity = await getEntityLoose(client, chatId);
        if (entity) {
            sourceName = getEntityLabel(entity);
            formattedSourceId = getFormattedEntityId(entity, formattedSourceId);
        }
    }
    catch {
    }
    const mediaInfo = extractMediaInfo(detailedMessage === null || detailedMessage === void 0 ? void 0 : detailedMessage.media);
    const messageDate = detailedMessage === null || detailedMessage === void 0 ? void 0 : detailedMessage.date;
    const replyToId = ((_a = detailedMessage === null || detailedMessage === void 0 ? void 0 : detailedMessage.replyTo) === null || _a === void 0 ? void 0 : _a.replyToMsgId) || null;
    const isOutgoing = (detailedMessage === null || detailedMessage === void 0 ? void 0 : detailedMessage.out) !== undefined ? detailedMessage.out : true;
    const finalRawText = getMessageText(detailedMessage, getMessageText(result, text));
    const finalText = getRichMessageText(detailedMessage, getRichMessageText(result, text));
    return [
        {
            json: {
                success: true,
                message: 'Message Edited successfully',
                id: result.id,
                sourceName,
                sourceId: formattedSourceId,
                text: finalText,
                rawText: finalRawText,
                date: messageDate,
                humanDate: messageDate ? formatDateWithTime(new Date(messageDate * 1000)) : null,
                fromId: getPeerIdString(detailedMessage === null || detailedMessage === void 0 ? void 0 : detailedMessage.fromId),
                chatId: formattedSourceId,
                isReply: !!replyToId,
                isOutgoing,
                direction: isOutgoing ? 'sent' : 'received',
                hasMedia: mediaInfo.hasMedia,
                mediaType: getMessageType(detailedMessage),
                noWebpage: noWebpage,
            },
            pairedItem: { item: i },
        },
    ];
}
async function editMessageMedia(client, i) {
    const editMediaFromSelf = this.getNodeParameter('editMediaFromSelf', i, false);
    const chatId = editMediaFromSelf ? 'me' : this.getNodeParameter('chatId', i);
    const messageId = Number(this.getNodeParameter('messageId', i));
    const media = this.getNodeParameter('media', i);
    const captionInput = this.getNodeParameter('caption', i, '');
    const captionEntitiesInput = this.getNodeParameter('captionEntities', i, []);
    let finalCaption = captionInput;
    let finalEntities = captionEntitiesInput;
    let debugInfo = 'Using new caption';
    const formattedCaptionInput = (0, messageFormatting_1.prepareTelegramTextInput)(captionInput);
    if (!captionInput || captionInput.trim() === '') {
        try {
            const messages = await getMessagesLoose(client, chatId, { ids: [messageId] });
            if (messages && messages.length > 0 && messages[0]) {
                const msg = messages[0];
                finalCaption = getMessageText(msg, captionInput);
                finalEntities = msg.entities || captionEntitiesInput;
                debugInfo = 'Successfully preserved original text';
            }
            else {
                debugInfo = `Error: Message ${messageId} not found in chat ${chatId}. Check your 'Chat ID' field!`;
            }
        }
        catch (error) {
            debugInfo = `Fetch error: ${error.message}`;
        }
    }
    const result = await (0, floodWaitHandler_1.safeExecute)(() => editMessageLoose(client, chatId, {
        message: messageId,
        file: media,
        text: finalEntities && finalEntities.length > 0
            ? finalCaption
            : formattedCaptionInput.text || finalCaption,
        parseMode: finalEntities && finalEntities.length > 0 ? undefined : formattedCaptionInput.parseMode,
        formattingEntities: finalEntities && finalEntities.length > 0 ? finalEntities : undefined,
    }));
    let detailedMessage = null;
    try {
        const messages = await getMessagesLoose(client, chatId, { ids: [result.id] });
        if (messages && messages.length > 0) {
            detailedMessage = messages[0];
        }
    }
    catch (error) {
        logger_1.logger.warn('Failed to fetch detailed message info after edit: ' + error.message);
    }
    return [
        {
            json: {
                success: true,
                id: result.id,
                text: getRichMessageText(result),
                rawText: getMessageText(result),
                debug_logic: debugInfo,
                target_chat: chatId,
                ...(detailedMessage && {
                    sourceName: 'Unknown',
                    sourceId: chatId,
                    date: detailedMessage.date,
                    humanDate: formatDateWithTime(new Date(detailedMessage.date * 1000)),
                    fromId: getPeerIdString(detailedMessage.fromId),
                    chatId: getPeerIdString(detailedMessage.peerId),
                    isReply: !!detailedMessage.replyTo,
                    isOutgoing: detailedMessage.out,
                    direction: detailedMessage.out ? 'sent' : 'received',
                    hasMedia: !!detailedMessage.media,
                    hasWebPreview: extractMediaInfo(detailedMessage.media).hasWebPreview,
                    mediaType: getMessageType(detailedMessage),
                }),
            },
            pairedItem: { item: i },
        },
    ];
}
async function deleteMessage(client, i) {
    var _a;
    const chatId = this.getNodeParameter('chatId', i);
    const messageId = Number(this.getNodeParameter('messageId', i));
    const revoke = this.getNodeParameter('revoke', i);
    let detailedMessage = null;
    try {
        const messages = await getMessagesLoose(client, chatId, { ids: [messageId] });
        if (messages && messages.length > 0) {
            detailedMessage = messages[0];
        }
    }
    catch (error) {
        logger_1.logger.warn('Failed to fetch message before delete: ' + error.message);
    }
    await (0, floodWaitHandler_1.safeExecute)(() => client.deleteMessages(chatId, [messageId], { revoke }));
    let sourceName = 'Unknown';
    let formattedSourceId = typeof chatId === 'string' ? chatId : '';
    try {
        const entity = await getEntityLoose(client, chatId);
        if (entity) {
            sourceName = getEntityLabel(entity);
            formattedSourceId = getFormattedEntityId(entity, formattedSourceId);
        }
    }
    catch {
    }
    const mediaInfo = extractMediaInfo(detailedMessage === null || detailedMessage === void 0 ? void 0 : detailedMessage.media);
    const messageDate = detailedMessage === null || detailedMessage === void 0 ? void 0 : detailedMessage.date;
    const replyToId = ((_a = detailedMessage === null || detailedMessage === void 0 ? void 0 : detailedMessage.replyTo) === null || _a === void 0 ? void 0 : _a.replyToMsgId) || null;
    const isOutgoing = (detailedMessage === null || detailedMessage === void 0 ? void 0 : detailedMessage.out) !== undefined ? detailedMessage.out : true;
    const finalRawText = getMessageText(detailedMessage);
    const finalText = getRichMessageText(detailedMessage);
    const fromId = getPeerIdString(detailedMessage === null || detailedMessage === void 0 ? void 0 : detailedMessage.fromId);
    return [
        {
            json: {
                success: true,
                message: 'Message Deleted successfully',
                id: messageId,
                sourceName,
                sourceId: formattedSourceId,
                text: finalText,
                rawText: finalRawText,
                date: messageDate,
                humanDate: messageDate ? formatDateWithTime(new Date(messageDate * 1000)) : null,
                fromId: fromId,
                chatId: formattedSourceId,
                isReply: !!replyToId,
                isOutgoing,
                direction: isOutgoing ? 'sent' : 'received',
                hasMedia: mediaInfo.hasMedia,
                hasWebPreview: mediaInfo.hasWebPreview,
                mediaType: getMessageType(detailedMessage),
                deletedId: messageId,
                revoked: revoke,
                'Delete of Everyone': revoke,
            },
            pairedItem: { item: i },
        },
    ];
}
async function deleteHistory(client, i) {
    var _a;
    const chatId = this.getNodeParameter('chatId', i);
    const maxId = this.getNodeParameter('maxId', i) || 0;
    const revoke = this.getNodeParameter('revoke', i);
    const normalizedChatId = String((_a = normalizePeerReference(chatId)) !== null && _a !== void 0 ? _a : chatId).trim();
    try {
        if (!normalizedChatId) {
            return [
                {
                    json: {
                        success: false,
                        chatId,
                        normalizedChatId,
                        errorCode: 'INVALID_CHAT_ID',
                        error: 'Chat ID is empty or invalid. Provide a numeric chat ID, @username, or a valid t.me link.',
                        operation: 'deleteHistory',
                        recoverable: true,
                    },
                    pairedItem: { item: i },
                },
            ];
        }
        if (!client.connected) {
            await client.connect();
        }
        const peer = await resolvePeer(client, normalizedChatId);
        let entity = null;
        try {
            entity = await getEntityLoose(client, normalizedChatId);
        }
        catch {
        }
        const peerKind = detectPeerKind(entity, peer);
        if (peerKind === 'channel') {
            let channelInput = toInputChannel(entity) || toInputChannel(peer);
            if (!channelInput) {
                try {
                    channelInput = toInputChannel(await client.getInputEntity(normalizedChatId));
                }
                catch {
                }
            }
            if (!revoke) {
                try {
                    await client.invoke(new teleproto_1.Api.channels.DeleteHistory({
                        channel: channelInput,
                        maxId: maxId,
                        forEveryone: false,
                    }));
                    return [
                        {
                            json: {
                                success: true,
                                chatId,
                                normalizedChatId,
                                deletedCount: null,
                                maxId: maxId,
                                revoked: false,
                                peerKind,
                                strategy: 'channels.DeleteHistory(local-clear)',
                            },
                            pairedItem: { item: i },
                        },
                    ];
                }
                catch (localError) {
                    const localMessage = localError instanceof Error ? localError.message : String(localError);
                    const localErrorCode = getRpcErrorCode(localMessage);
                    return [
                        {
                            json: {
                                success: false,
                                chatId,
                                normalizedChatId,
                                errorCode: localErrorCode,
                                error: localMessage,
                                operation: 'deleteHistory',
                                recoverable: true,
                                peerKind,
                                strategy: 'channels.DeleteHistory(local-clear)',
                                hint: localErrorCode === 'PEER_ID_INVALID'
                                    ? 'This account could not resolve a valid InputPeer for local clear. Open this channel once in Telegram app and retry, or pass @username instead of numeric ID.'
                                    : 'Telegram did not allow local channel history clear for this chat.',
                            },
                            pairedItem: { item: i },
                        },
                    ];
                }
            }
            const everyonePermission = canDeleteHistoryForEveryone(entity);
            if (everyonePermission === false) {
                return [
                    {
                        json: {
                            success: false,
                            chatId,
                            normalizedChatId,
                            errorCode: 'ADMIN_REQUIRED',
                            error: 'Delete for Everyone requires channel/supergroup admin rights (delete messages). Turn off Delete for Everyone to clear only your own history.',
                            operation: 'deleteHistory',
                            recoverable: true,
                            hint: 'Set "Delete for Everyone" to false, or run with an admin account.',
                        },
                        pairedItem: { item: i },
                    },
                ];
            }
            if (!channelInput) {
                return [
                    {
                        json: {
                            success: false,
                            chatId,
                            normalizedChatId,
                            errorCode: 'CHANNEL_RESOLVE_FAILED',
                            error: 'Unable to build InputChannel with access hash for this channel. Open the channel once and retry.',
                            operation: 'deleteHistory',
                            recoverable: true,
                            peerKind,
                            strategy: 'channels.DeleteHistory',
                        },
                        pairedItem: { item: i },
                    },
                ];
            }
            try {
                await client.invoke(new teleproto_1.Api.channels.DeleteHistory({
                    channel: channelInput,
                    maxId: maxId,
                    forEveryone: true,
                }));
                return [
                    {
                        json: {
                            success: true,
                            chatId,
                            normalizedChatId,
                            deletedCount: null,
                            maxId: maxId,
                            revoked: revoke,
                            peerKind,
                            strategy: 'channels.DeleteHistory',
                        },
                        pairedItem: { item: i },
                    },
                ];
            }
            catch (channelError) {
                const channelMessage = channelError instanceof Error ? channelError.message : String(channelError);
                const channelErrorCode = getRpcErrorCode(channelMessage);
                const isAdminError = isAdminRequiredErrorCode(channelErrorCode) ||
                    (channelErrorCode === 'CHANNEL_INVALID' && revoke && !!entity);
                return [
                    {
                        json: {
                            success: false,
                            chatId,
                            normalizedChatId,
                            errorCode: isAdminError ? 'ADMIN_REQUIRED' : channelErrorCode,
                            error: channelMessage,
                            operation: 'deleteHistory',
                            recoverable: true,
                            peerKind,
                            strategy: 'channels.DeleteHistory',
                            hint: isAdminError || (revoke && channelErrorCode === 'PEER_ID_INVALID')
                                ? 'Delete for Everyone needs admin rights. Set "Delete for Everyone" to false to clear only your side.'
                                : 'If this channel is private, ensure this account is a member and can open it in Telegram app.',
                        },
                        pairedItem: { item: i },
                    },
                ];
            }
        }
        let preDeleteCount = 0;
        try {
            const countResult = (await client.getMessages(peer, { limit: 0 }));
            preDeleteCount = countResult.total || 0;
        }
        catch {
        }
        let offset = 0;
        let response;
        let loopCount = 0;
        do {
            try {
                response = (await client.invoke(new teleproto_1.Api.messages.DeleteHistory({
                    peer: peer,
                    maxId: maxId,
                    revoke: revoke,
                    justClear: false,
                })));
            }
            catch (messagesError) {
                const messagesErrorMessage = messagesError instanceof Error ? messagesError.message : String(messagesError);
                const messagesErrorCode = getRpcErrorCode(messagesErrorMessage);
                if (messagesErrorCode === 'PEER_ID_INVALID' && peerKind === 'unknown') {
                    await client.invoke(new teleproto_1.Api.channels.DeleteHistory({
                        channel: peer,
                        maxId: maxId,
                        forEveryone: revoke,
                    }));
                    return [
                        {
                            json: {
                                success: true,
                                chatId,
                                normalizedChatId,
                                deletedCount: null,
                                maxId: maxId,
                                revoked: revoke,
                                iterations: 1,
                                peerKind: 'channel',
                                strategy: 'channels.DeleteHistory(fallback)',
                            },
                            pairedItem: { item: i },
                        },
                    ];
                }
                throw (0, nodeOperationError_1.asNodeOperationError)(messagesError, { context: this, itemIndex: i });
            }
            offset = response.offset;
            loopCount++;
            if (loopCount > 100) {
                throw (0, nodeOperationError_1.createNodeOperationError)(`Delete history safety cap exceeded after ${loopCount} iterations (offset=${offset}). Aborting to prevent an infinite loop.`, { context: this, itemIndex: i });
            }
            if (offset > 0)
                await new Promise((resolve) => setTimeout(resolve, 100));
        } while (offset > 0);
        return [
            {
                json: {
                    success: true,
                    chatId,
                    normalizedChatId,
                    deletedCount: preDeleteCount,
                    maxId: maxId,
                    revoked: revoke,
                    iterations: loopCount,
                    peerKind,
                    strategy: 'messages.DeleteHistory',
                },
                pairedItem: { item: i },
            },
        ];
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const errorCode = getRpcErrorCode(message);
        const isPeerResolutionIssue = errorCode === 'PEER_ID_INVALID' ||
            message.toLowerCase().includes('could not resolve telegram entity');
        const isAdminError = errorCode === 'CHAT_ADMIN_REQUIRED' ||
            errorCode === 'RIGHT_FORBIDDEN' ||
            errorCode === 'MESSAGE_DELETE_FORBIDDEN';
        return [
            {
                json: {
                    success: false,
                    chatId,
                    normalizedChatId,
                    errorCode: isAdminError ? 'ADMIN_REQUIRED' : errorCode,
                    error: message,
                    operation: 'deleteHistory',
                    recoverable: true,
                    hint: isAdminError
                        ? 'You do not have permission to delete for everyone in this chat. Set "Delete for Everyone" to false.'
                        : isPeerResolutionIssue
                            ? 'Make sure this account has access to the target chat. Try @username or open the chat once so Telegram can cache entity access.'
                            : undefined,
                },
                pairedItem: { item: i },
            },
        ];
    }
}
async function pinMessage(client, i) {
    var _a;
    const chatId = this.getNodeParameter('chatId', i);
    const messageId = Number(this.getNodeParameter('messageId', i));
    const notify = this.getNodeParameter('notify', i);
    await (0, floodWaitHandler_1.safeExecute)(() => client.pinMessage(chatId, messageId, { notify }));
    let detailedMessage = null;
    try {
        const messages = await getMessagesLoose(client, chatId, { ids: [messageId] });
        if (messages && messages.length > 0) {
            detailedMessage = messages[0];
        }
    }
    catch (error) {
        logger_1.logger.warn('Failed to fetch detailed message info after pin: ' + error.message);
    }
    let sourceName = 'Unknown';
    let formattedSourceId = typeof chatId === 'string' ? chatId : '';
    try {
        const entity = await getEntityLoose(client, chatId);
        if (entity) {
            sourceName = getEntityLabel(entity);
            formattedSourceId = getFormattedEntityId(entity, formattedSourceId);
        }
    }
    catch {
    }
    const mediaInfo = extractMediaInfo(detailedMessage === null || detailedMessage === void 0 ? void 0 : detailedMessage.media);
    const messageDate = detailedMessage === null || detailedMessage === void 0 ? void 0 : detailedMessage.date;
    const replyToId = ((_a = detailedMessage === null || detailedMessage === void 0 ? void 0 : detailedMessage.replyTo) === null || _a === void 0 ? void 0 : _a.replyToMsgId) || null;
    const isOutgoing = (detailedMessage === null || detailedMessage === void 0 ? void 0 : detailedMessage.out) !== undefined ? detailedMessage.out : true;
    const finalRawText = getMessageText(detailedMessage);
    const finalText = getRichMessageText(detailedMessage);
    const fromId = getPeerIdString(detailedMessage === null || detailedMessage === void 0 ? void 0 : detailedMessage.fromId);
    return [
        {
            json: {
                success: true,
                message: 'Message Pinned successfully',
                id: messageId,
                sourceName,
                sourceId: formattedSourceId,
                text: finalText,
                rawText: finalRawText,
                date: messageDate,
                humanDate: messageDate ? formatDateWithTime(new Date(messageDate * 1000)) : null,
                fromId,
                chatId: formattedSourceId,
                isReply: !!replyToId,
                isOutgoing,
                direction: isOutgoing ? 'sent' : 'received',
                hasMedia: mediaInfo.hasMedia,
                hasWebPreview: mediaInfo.hasWebPreview,
                mediaType: getMessageType(detailedMessage),
                notified: notify,
                pinnedId: messageId,
            },
            pairedItem: { item: i },
        },
    ];
}
async function sendText(client, i, creds) {
    var _a, _b, _c;
    const sendToSelf = this.getNodeParameter('sendToSelf', i, false);
    const chatId = sendToSelf ? 'me' : this.getNodeParameter('chatId', i);
    const text = this.getNodeParameter('text', i);
    const replyTo = this.getNodeParameter('replyTo', i);
    const webPreview = this.getNodeParameter('webPreview', i, true);
    const attachMedia = this.getNodeParameter('attachMedia', i, false);
    const mediaUrl = this.getNodeParameter('mediaUrl', i, '');
    const formattedInput = (0, messageFormatting_1.prepareTelegramTextInput)(text);
    let fileToSend;
    let downloadedUrlFile;
    let hasMedia = false;
    let mediaType = 'other';
    const selectedType = this.getNodeParameter('mediaType', i, 'document');
    if (creds) {
        (0, clientManager_1.markClientActive)(creds.apiId, creds.session);
    }
    try {
        if (!webPreview && attachMedia && selectedType !== 'text') {
            const binaryProperty = this.getNodeParameter('mediaBinaryProperty', i, 'data');
            const items = this.getInputData();
            const item = items[i];
            const binaryData = (_a = item === null || item === void 0 ? void 0 : item.binary) === null || _a === void 0 ? void 0 : _a[binaryProperty];
            if (binaryData) {
                const buffer = await this.helpers.getBinaryDataBuffer(i, binaryProperty);
                const fileName = binaryData.fileName || `upload_${Date.now()}`;
                fileToSend = new uploads_1.CustomFile(fileName, buffer.length, '', buffer);
                hasMedia = true;
                mediaType = selectedType || inferMediaTypeFromMime(binaryData.mimeType);
            }
            else if (mediaUrl && mediaUrl.trim() !== '') {
                downloadedUrlFile = await downloadUrlToCustomFile(mediaUrl);
                fileToSend = downloadedUrlFile.file;
                hasMedia = true;
                mediaType =
                    selectedType ||
                        inferMediaTypeFromMime(downloadedUrlFile.mimeType) ||
                        inferMediaTypeFromMimeFromUrl(mediaUrl);
            }
            else {
                throw new Error(`Binary property '${binaryProperty}' is missing or empty on item ${i} and no Media URL provided`);
            }
        }
        let activeClient = client;
        if (creds && downloadedUrlFile) {
            activeClient = await (0, clientManager_1.ensureConnected)(creds.apiId, creds.apiHash, creds.session);
        }
        const result = await (0, rateLimiter_1.withRateLimit)(async () => (0, floodWaitHandler_1.safeExecute)(() => sendMessageLoose(activeClient, chatId, {
            message: formattedInput.text,
            replyTo: replyTo > 0 ? replyTo : undefined,
            linkPreview: webPreview,
            file: fileToSend,
            parseMode: formattedInput.parseMode,
            supportStreaming: mediaType === 'video' ? true : undefined,
        })));
        const msg = result;
        const resolvedMediaType = hasMedia ? mediaType : getMessageType(msg);
        const chatIdStr = (_c = (_b = chatId === null || chatId === void 0 ? void 0 : chatId.toString) === null || _b === void 0 ? void 0 : _b.call(chatId)) !== null && _c !== void 0 ? _c : '';
        const textStr = text !== null && text !== void 0 ? text : '';
        return await formatSendResult.call(this, activeClient, msg, chatIdStr, textStr, hasMedia, resolvedMediaType, replyTo, i, !!fileToSend ||
            (msg.media &&
                (msg.media.className === 'MessageMediaWebPage' || msg.media._ === 'messageMediaWebPage'))
            ? true
            : undefined);
    }
    finally {
        if (creds) {
            (0, clientManager_1.markClientIdle)(creds.apiId, creds.session);
        }
        if (downloadedUrlFile) {
            await cleanupDownloadedUrlFile(downloadedUrlFile);
        }
    }
}
async function formatSendResult(client, msg, chatId, text, hasMedia, mediaType, replyTo, i, hasWebPreviewOverride) {
    var _a, _b;
    let senderId = getPeerIdString(msg.fromId);
    if (!senderId) {
        try {
            const me = await client.getMe();
            senderId = ((_a = me === null || me === void 0 ? void 0 : me.id) === null || _a === void 0 ? void 0 : _a.toString()) || null;
        }
        catch {
            senderId = null;
        }
    }
    let sourceName = 'Unknown';
    let formattedSourceId = typeof chatId === 'string' ? chatId : '';
    try {
        const entity = await getEntityLoose(client, chatId);
        if (entity) {
            sourceName = getEntityLabel(entity);
            formattedSourceId = getFormattedEntityId(entity, formattedSourceId);
        }
    }
    catch {
    }
    const mediaInfo = extractMediaInfo(msg.media);
    const finalHasMedia = hasMedia || mediaInfo.hasMedia;
    const finalMediaType = hasMedia ? mediaType : getMessageType(msg);
    const messageDate = msg.date;
    const finalRawText = getMessageText(msg, text);
    const finalText = getRichMessageText(msg, text);
    const isOutgoing = msg.out !== undefined ? msg.out : true;
    const replyToId = ((_b = msg.replyTo) === null || _b === void 0 ? void 0 : _b.replyToMsgId) || null;
    return [
        {
            json: {
                success: true,
                message: 'Message Send Successfully',
                id: msg.id,
                sourceName,
                sourceId: formattedSourceId,
                text: finalText,
                rawText: finalRawText,
                date: messageDate,
                humanDate: messageDate ? formatDateWithTime(new Date(messageDate * 1000)) : null,
                fromId: senderId,
                chatId: formattedSourceId,
                isReply: replyTo > 0 || !!replyToId,
                isOutgoing,
                direction: isOutgoing ? 'sent' : 'received',
                hasMedia: finalHasMedia,
                hasWebPreview: hasWebPreviewOverride !== undefined ? hasWebPreviewOverride : mediaInfo.hasWebPreview,
                mediaType: finalMediaType,
                replyToId,
            },
            pairedItem: { item: i },
        },
    ];
}
function inferMediaTypeFromMime(mime) {
    if (!mime)
        return 'document';
    if (mime.startsWith('image/'))
        return 'photo';
    if (mime.startsWith('video/'))
        return 'video';
    return 'document';
}
function inferMediaTypeFromMimeFromUrl(url) {
    const lower = url.toLowerCase();
    if (lower.match(/\.jpg|\.jpeg|\.png|\.gif|\.webp|\.heic|\.heif/))
        return 'photo';
    if (lower.match(/\.mp4|\.mov|\.mkv|\.webm/))
        return 'video';
    return 'document';
}
async function downloadUrlToCustomFile(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), URL_MEDIA_DOWNLOAD_TIMEOUT_MS);
    let filePath;
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            keepalive: false,
        });
        if (!res.ok) {
            throw (0, nodeOperationError_1.createNodeOperationError)(`Failed to download media from URL: ${res.status} ${res.statusText}`);
        }
        if (!res.body) {
            throw (0, nodeOperationError_1.createNodeOperationError)('Failed to download media from URL: response body is empty');
        }
        const mimeType = res.headers.get('content-type') || undefined;
        const fileName = getSafeDownloadFileName(url, res.headers.get('content-disposition'), mimeType);
        const downloadDirectory = path_1.default.join((0, os_1.tmpdir)(), 'n8n-telegram-grampro-upload');
        await (0, promises_1.mkdir)(downloadDirectory, { recursive: true });
        filePath = path_1.default.join(downloadDirectory, `${Date.now()}-${(0, crypto_1.randomBytes)(6).toString('hex')}-${fileName}`);
        const downloadedBytes = await streamResponseBodyToFile(res.body, filePath);
        const expectedBytes = getContentLength(res.headers.get('content-length'));
        if (expectedBytes !== undefined && downloadedBytes !== expectedBytes) {
            throw (0, nodeOperationError_1.createNodeOperationError)(`Failed to download complete media from URL: expected ${expectedBytes} bytes, received ${downloadedBytes} bytes`);
        }
        const fileStats = await (0, promises_1.stat)(filePath);
        return {
            file: new uploads_1.CustomFile(fileName, fileStats.size, filePath),
            filePath,
            fileName,
            mimeType,
        };
    }
    catch (error) {
        if (filePath) {
            await deleteTemporaryFile(filePath);
        }
        if (error instanceof Error && error.name === 'AbortError') {
            throw (0, nodeOperationError_1.createNodeOperationError)(`Timed out downloading media from URL after ${Math.round(URL_MEDIA_DOWNLOAD_TIMEOUT_MS / 60000)} minutes`, { cause: error });
        }
        throw (0, nodeOperationError_1.asNodeOperationError)(error);
    }
    finally {
        clearTimeout(timeout);
    }
}
async function streamResponseBodyToFile(webStream, filePath) {
    let nodeReadable;
    try {
        nodeReadable = stream_1.Readable.fromWeb(webStream);
    }
    catch {
        const chunks = [];
        const reader = webStream.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            chunks.push(Buffer.from(value));
        }
        const fullBuffer = Buffer.concat(chunks);
        const { writeFile } = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        await writeFile(filePath, fullBuffer, { flag: 'wx' });
        return fullBuffer.length;
    }
    let bytesWritten = 0;
    const counter = new stream_1.Transform({
        transform(chunk, _encoding, callback) {
            bytesWritten += chunk.length;
            callback(null, chunk);
        },
    });
    const fileWriter = (0, fs_1.createWriteStream)(filePath, { flags: 'wx' });
    try {
        await (0, promises_2.pipeline)(nodeReadable, counter, fileWriter);
        return bytesWritten;
    }
    catch (error) {
        throw (0, nodeOperationError_1.createNodeOperationError)(`Failed to write downloaded media to temporary file: ${getUnknownErrorMessage(error)}`, { cause: error });
    }
}
function getContentLength(value) {
    if (!value) {
        return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
function getUnknownErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function getSafeDownloadFileName(url, contentDisposition, mimeType) {
    const fromDisposition = getFileNameFromContentDisposition(contentDisposition);
    const fromUrl = getFileNameFromUrl(url);
    const fallback = `upload_${Date.now()}${getExtensionFromMimeType(mimeType)}`;
    const candidate = fromDisposition || fromUrl || fallback;
    const safeName = sanitizeFileName(path_1.default.basename(candidate));
    return (safeName || fallback).slice(0, 180);
}
function sanitizeFileName(fileName) {
    return Array.from(fileName)
        .map((char) => {
        const charCode = char.charCodeAt(0);
        return charCode < 32 || '<>:"/\\|?*'.includes(char) ? '_' : char;
    })
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
}
function getFileNameFromContentDisposition(contentDisposition) {
    var _a;
    if (!contentDisposition) {
        return undefined;
    }
    const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (encodedMatch === null || encodedMatch === void 0 ? void 0 : encodedMatch[1]) {
        try {
            return decodeURIComponent(encodedMatch[1].trim());
        }
        catch {
            return encodedMatch[1].trim();
        }
    }
    const match = contentDisposition.match(/filename="?([^";]+)"?/i);
    return (_a = match === null || match === void 0 ? void 0 : match[1]) === null || _a === void 0 ? void 0 : _a.trim();
}
function getFileNameFromUrl(url) {
    try {
        const parsedUrl = new URL(url);
        const lastPathSegment = parsedUrl.pathname.split('/').filter(Boolean).pop();
        return lastPathSegment ? decodeURIComponent(lastPathSegment) : undefined;
    }
    catch {
        return undefined;
    }
}
function getExtensionFromMimeType(mimeType) {
    if (!mimeType) {
        return '';
    }
    const normalized = mimeType.split(';')[0].trim().toLowerCase();
    const extensionByMimeType = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'video/mp4': '.mp4',
        'video/quicktime': '.mov',
        'video/webm': '.webm',
    };
    return extensionByMimeType[normalized] || '';
}
async function cleanupDownloadedUrlFile(downloadedUrlFile) {
    await deleteTemporaryFile(downloadedUrlFile.filePath);
}
async function deleteTemporaryFile(filePath) {
    try {
        await (0, promises_1.unlink)(filePath);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.logger.warn(`Failed to remove temporary media file ${filePath}: ${message}`);
    }
}
function extractMediaInfo(media) {
    var _a;
    if (!media)
        return { hasMedia: false, mediaType: 'other', hasWebPreview: false };
    if (media.photo || media.className === 'MessageMediaPhoto' || media._ === 'messageMediaPhoto') {
        return { hasMedia: true, mediaType: 'photo', hasWebPreview: false };
    }
    const document = media.document ||
        (media === null || media === void 0 ? void 0 : media.className) === 'MessageMediaDocument' ||
        (media === null || media === void 0 ? void 0 : media._) === 'messageMediaDocument';
    if (document) {
        const mimeType = ((_a = media.document) === null || _a === void 0 ? void 0 : _a.mimeType) || '';
        if (mimeType.startsWith('video/'))
            return { hasMedia: true, mediaType: 'video', hasWebPreview: false };
        if (mimeType.startsWith('image/'))
            return { hasMedia: true, mediaType: 'photo', hasWebPreview: false };
        return { hasMedia: true, mediaType: 'document', hasWebPreview: false };
    }
    if (media.video)
        return { hasMedia: true, mediaType: 'video', hasWebPreview: false };
    if (media.className === 'MessageMediaWebPage' || media._ === 'messageMediaWebPage') {
        const webpage = media.webpage;
        return {
            hasMedia: false,
            mediaType: 'other',
            hasWebPreview: !(webpage instanceof teleproto_1.Api.WebPageEmpty) || !!webpage,
        };
    }
    if ('webpage' in media) {
        const webpage = media.webpage;
        return {
            hasMedia: false,
            mediaType: 'other',
            hasWebPreview: !!webpage && !(webpage instanceof teleproto_1.Api.WebPageEmpty),
        };
    }
    return { hasMedia: true, mediaType: 'other', hasWebPreview: false };
}
function getMessageType(message) {
    const mediaInfo = extractMediaInfo(message === null || message === void 0 ? void 0 : message.media);
    if (mediaInfo.hasMedia) {
        return mediaInfo.mediaType;
    }
    return getMessageText(message).trim() ? 'text' : 'other';
}
function formatDateWithTime(date) {
    const istFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    });
    const parts = istFormatter.formatToParts(date);
    const part = (type) => { var _a; return ((_a = parts.find((p) => p.type === type)) === null || _a === void 0 ? void 0 : _a.value) || ''; };
    const day = part('day');
    const month = part('month');
    const year = part('year');
    const hour = part('hour');
    const minute = part('minute');
    const second = part('second');
    const dayPeriod = part('dayPeriod');
    const formattedDate = `${day}-${month}-${year}`;
    const timePart = `${hour}:${minute}:${second} ${dayPeriod}`;
    return `${formattedDate} (${timePart})`;
}
async function forwardMessage(client, i) {
    var _a;
    const sourceChatId = this.getNodeParameter('sourceChatId', i);
    const saveToSavedMessages = this.getNodeParameter('saveToSavedMessages', i, false);
    const targetChatId = saveToSavedMessages ? 'me' : this.getNodeParameter('targetChatId', i);
    const messageId = Number(this.getNodeParameter('messageId', i));
    const result = await forwardMessagesLoose(client, saveToSavedMessages ? 'me' : targetChatId, {
        fromPeer: sourceChatId,
        messages: [messageId],
    });
    const msg = result;
    const senderId = getPeerIdString(msg.fromId);
    let sourceName = 'Unknown';
    let formattedTargetId = typeof targetChatId === 'string' ? targetChatId : '';
    try {
        const entity = await getEntityLoose(client, targetChatId);
        if (entity) {
            sourceName = getEntityLabel(entity);
            formattedTargetId = getFormattedEntityId(entity, formattedTargetId);
        }
    }
    catch {
    }
    const mediaInfo = extractMediaInfo(msg.media);
    const messageDate = msg.date;
    const isOutgoing = msg.out !== undefined ? msg.out : true;
    const replyToId = ((_a = msg.replyTo) === null || _a === void 0 ? void 0 : _a.replyToMsgId) || null;
    return [
        {
            json: {
                success: true,
                message: 'Message forwarded successfully',
                id: msg.id,
                sourceName,
                sourceId: formattedTargetId,
                text: getRichMessageText(msg),
                rawText: getMessageText(msg),
                date: messageDate,
                humanDate: messageDate ? formatDateWithTime(new Date(messageDate * 1000)) : null,
                fromId: senderId,
                chatId: formattedTargetId,
                isReply: !!replyToId,
                isOutgoing,
                direction: isOutgoing ? 'sent' : 'received',
                hasMedia: mediaInfo.hasMedia,
                hasWebPreview: mediaInfo.hasWebPreview,
                mediaType: getMessageType(msg),
                replyToId,
            },
            pairedItem: { item: i },
        },
    ];
}
async function getHistory(client, i) {
    var _a, _b, _c, _d;
    const historyFromSelf = this.getNodeParameter('historyFromSelf', i, false);
    let chatIdInput = historyFromSelf ? 'me' : this.getNodeParameter('chatId', i);
    const mode = this.getNodeParameter('mode', i, 'limit');
    const onlyMedia = this.getNodeParameter('onlyMedia', i, false);
    const mediaTypes = this.getNodeParameter('mediaType', i, []);
    let replyToMsgId = undefined;
    if (!historyFromSelf && chatIdInput) {
        const topicMatch = chatIdInput.match(/(?:https?:\/\/)?t\.me\/(?:c\/)?([a-zA-Z0-9_-]+)\/(\d+)\/?$/);
        if (topicMatch) {
            chatIdInput = topicMatch[1];
            if (chatIdInput.match(/^\d+$/)) {
                chatIdInput = `-100${chatIdInput}`;
            }
            replyToMsgId = parseInt(topicMatch[2], 10);
        }
        else {
            const shortMatch = chatIdInput.match(/(?:https?:\/\/)?t\.me\/(?:c\/)?([a-zA-Z0-9_-]+)\/?$/);
            if (shortMatch) {
                chatIdInput = shortMatch[1];
                if (chatIdInput.match(/^\d+$/)) {
                    chatIdInput = `-100${chatIdInput}`;
                }
            }
        }
    }
    let messages = [];
    let requestedLimit = 50;
    if (mode === 'limit') {
        requestedLimit = this.getNodeParameter('limit', i, 10);
        const fetchLimit = requestedLimit + 10;
        const result = await (0, floodWaitHandler_1.safeExecute)(() => getMessagesLoose(client, chatIdInput, { limit: fetchLimit, replyTo: replyToMsgId }));
        messages = Array.isArray(result) ? result : [];
    }
    else {
        const maxMessages = this.getNodeParameter('maxMessages', i, 500);
        const iterOptions = {};
        if (maxMessages > 0)
            iterOptions.limit = maxMessages;
        if (replyToMsgId)
            iterOptions.replyTo = replyToMsgId;
        if (mode === 'hours') {
            const hours = this.getNodeParameter('hours', i, 24);
            const cutoffTime = Math.floor(Date.now() / 1000) - hours * 3600;
            for await (const msg of iterMessagesLoose(client, chatIdInput, iterOptions)) {
                if (msg.date < cutoffTime)
                    break;
                messages.push(msg);
            }
        }
        else if (mode === 'range') {
            const fromDateStr = this.getNodeParameter('fromDate', i, '');
            const toDateStr = this.getNodeParameter('toDate', i, '');
            const fromTime = fromDateStr ? Math.floor(new Date(fromDateStr).getTime() / 1000) : 0;
            const toTime = toDateStr
                ? Math.floor(new Date(toDateStr).getTime() / 1000)
                : Math.floor(Date.now() / 1000);
            for await (const msg of iterMessagesLoose(client, chatIdInput, iterOptions)) {
                if (msg.date > toTime)
                    continue;
                if (msg.date < fromTime)
                    break;
                messages.push(msg);
            }
        }
    }
    const items = [];
    const chatEntity = (await getEntityLoose(client, chatIdInput));
    const resolvedPeer = await resolvePeer(client, chatIdInput);
    const includeStats = this.getNodeParameter('includeStats', i, false);
    const includeReactions = this.getNodeParameter('includeReactions', i, true);
    const statsByMessageId = new Map();
    const groups = new Map();
    const orderedGroups = [];
    for (const m of messages) {
        if (!m || m._ === 'MessageEmpty' || m.className === 'MessageEmpty')
            continue;
        const gid = (_a = m.groupedId) === null || _a === void 0 ? void 0 : _a.toString();
        if (gid) {
            if (!groups.has(gid)) {
                const group = [];
                groups.set(gid, group);
                orderedGroups.push({ type: 'album', messages: group });
            }
            groups.get(gid).push(m);
        }
        else {
            orderedGroups.push({ type: 'single', messages: [m] });
        }
    }
    const senderIdSet = new Set();
    for (const m of messages) {
        const sid = (_b = m.senderId) === null || _b === void 0 ? void 0 : _b.toString();
        if (sid)
            senderIdSet.add(sid);
    }
    const senderEntities = new Map();
    if (senderIdSet.size > 0) {
        try {
            const entities = (await client.getEntity(Array.from(senderIdSet)));
            for (const ent of entities) {
                const id = (_c = ent.id) === null || _c === void 0 ? void 0 : _c.toString();
                if (id)
                    senderEntities.set(id, ent);
            }
        }
        catch (err) {
            logger_1.logger.warn('Failed to batch fetch sender entities for history: ' + err.message);
        }
    }
    if (includeStats && orderedGroups.length > 0) {
        const primaryIds = orderedGroups.map((group) => group.messages[0].id);
        await enrichHistoryStats(client, resolvedPeer, chatEntity, primaryIds, includeReactions, statsByMessageId);
    }
    for (const group of orderedGroups) {
        const primaryMessage = group.messages[0];
        const messageObj = primaryMessage;
        const senderId = (_d = messageObj.senderId) === null || _d === void 0 ? void 0 : _d.toString();
        const senderEntity = senderId ? senderEntities.get(senderId) : undefined;
        const mediaInfo = extractMediaInfo(primaryMessage.media);
        const messageType = getMessageType(primaryMessage);
        const hasMedia = mediaInfo.hasMedia;
        const wantsNonMediaMessages = mediaTypes.includes('text') || mediaTypes.includes('other');
        if (onlyMedia && !hasMedia && !wantsNonMediaMessages)
            continue;
        if (onlyMedia && mediaTypes.length > 0 && !mediaTypes.includes(messageType)) {
            continue;
        }
        const messageContext = (0, payloadBuilders_1.resolveMessageContextFromEntities)(messageObj, chatEntity, senderEntity);
        let payload;
        if (group.type === 'album') {
            payload = (0, payloadBuilders_1.buildSharedAlbumPayload)(group.messages, messageContext);
        }
        else {
            payload = (0, payloadBuilders_1.buildSharedMessagePayload)(messageObj, messageContext);
        }
        items.push({
            json: {
                ...payload,
                humanDate: formatDateWithTime(new Date(primaryMessage.date * 1000)),
                ...(includeStats ? statsByMessageId.get(primaryMessage.id) : {}),
            },
            pairedItem: { item: i },
        });
    }
    return items.slice(0, requestedLimit);
}
async function unpinMessage(client, i) {
    var _a;
    const chatId = this.getNodeParameter('chatId', i);
    const messageId = Number(this.getNodeParameter('messageId', i));
    await (0, floodWaitHandler_1.safeExecute)(() => client.invoke(new teleproto_1.Api.messages.UpdatePinnedMessage({
        peer: chatId,
        id: messageId,
        unpin: true,
    })));
    let detailedMessage = null;
    try {
        const messages = await getMessagesLoose(client, chatId, { ids: [messageId] });
        if (messages && messages.length > 0) {
            detailedMessage = messages[0];
        }
    }
    catch (error) {
        logger_1.logger.warn('Failed to fetch detailed message info after unpin: ' + error.message);
    }
    let sourceName = 'Unknown';
    let formattedSourceId = typeof chatId === 'string' ? chatId : '';
    try {
        const entity = await getEntityLoose(client, chatId);
        if (entity) {
            sourceName = getEntityLabel(entity);
            formattedSourceId = getFormattedEntityId(entity, formattedSourceId);
        }
    }
    catch {
    }
    const mediaInfo = extractMediaInfo(detailedMessage === null || detailedMessage === void 0 ? void 0 : detailedMessage.media);
    const messageDate = detailedMessage === null || detailedMessage === void 0 ? void 0 : detailedMessage.date;
    const replyToId = ((_a = detailedMessage === null || detailedMessage === void 0 ? void 0 : detailedMessage.replyTo) === null || _a === void 0 ? void 0 : _a.replyToMsgId) || null;
    const isOutgoing = (detailedMessage === null || detailedMessage === void 0 ? void 0 : detailedMessage.out) !== undefined ? detailedMessage.out : true;
    const finalRawText = getMessageText(detailedMessage);
    const finalText = getRichMessageText(detailedMessage);
    const fromId = getPeerIdString(detailedMessage === null || detailedMessage === void 0 ? void 0 : detailedMessage.fromId);
    return [
        {
            json: {
                success: true,
                message: 'Message Unpinned successfully',
                id: messageId,
                sourceName,
                sourceId: formattedSourceId,
                text: finalText,
                rawText: finalRawText,
                date: messageDate,
                humanDate: messageDate ? formatDateWithTime(new Date(messageDate * 1000)) : null,
                fromId,
                chatId: formattedSourceId,
                isReply: !!replyToId,
                isOutgoing,
                direction: isOutgoing ? 'sent' : 'received',
                hasMedia: mediaInfo.hasMedia,
                hasWebPreview: mediaInfo.hasWebPreview,
                mediaType: getMessageType(detailedMessage),
                unpinnedId: messageId,
            },
            pairedItem: { item: i },
        },
    ];
}
async function sendPoll(client, i) {
    const chatId = this.getNodeParameter('chatId', i);
    const question = this.getNodeParameter('pollQuestion', i);
    const options = this.getNodeParameter('pollOptions', i);
    const isQuiz = this.getNodeParameter('isQuiz', i);
    const isAnonymous = this.getNodeParameter('anonymous', i, true);
    let correctAnswers = undefined;
    if (isQuiz) {
        const correctIndex = this.getNodeParameter('correctAnswerIndex', i);
        correctAnswers = [correctIndex];
    }
    const peer = await getEntityLoose(client, chatId);
    const isBroadcastChannel = peer.className === 'Channel' && peer.broadcast === true;
    const publicVoters = isBroadcastChannel ? false : !isAnonymous;
    const pollId = (0, big_integer_1.default)(Math.floor(Math.random() * 1000000000));
    await (0, floodWaitHandler_1.safeExecute)(() => client.invoke(new teleproto_1.Api.messages.SendMedia({
        peer: chatId,
        media: new teleproto_1.Api.InputMediaPoll({
            poll: new teleproto_1.Api.Poll({
                id: pollId,
                question: new teleproto_1.Api.TextWithEntities({
                    text: question,
                    entities: [],
                }),
                answers: options.map((opt, index) => new teleproto_1.Api.PollAnswer({
                    text: new teleproto_1.Api.TextWithEntities({ text: opt, entities: [] }),
                    option: Buffer.from(index.toString()),
                })),
                closed: false,
                publicVoters: publicVoters,
                multipleChoice: false,
                quiz: isQuiz,
                hash: (0, big_integer_1.default)(0),
            }),
            correctAnswers: correctAnswers,
        }),
        message: '',
        randomId: (0, big_integer_1.default)(Math.floor(Math.random() * 1000000000)),
    })));
    const pollType = isAnonymous ? 'Anonymous Voting' : 'Public Voting';
    const formattedDate = null;
    return [
        {
            json: {
                success: true,
                message: 'Create Poll successfully',
                pollId: pollId.toString(),
                title: question,
                options: options.join(', '),
                poll_type: pollType,
                create_time: formattedDate,
                isQuiz: isQuiz,
            },
            pairedItem: { item: i },
        },
    ];
}
async function copyMessage(client, i) {
    const sourceChatId = this.getNodeParameter('sourceChatId', i);
    const saveToSavedMessages = this.getNodeParameter('saveToSavedMessages', i, false);
    const targetChatId = saveToSavedMessages ? 'me' : this.getNodeParameter('targetChatId', i);
    const messageId = Number(this.getNodeParameter('messageId', i));
    const caption = this.getNodeParameter('caption', i, '');
    const disableLinkPreview = this.getNodeParameter('disableLinkPreview', i, false);
    const formattedCaptionInput = (0, messageFormatting_1.prepareTelegramTextInput)(caption);
    logger_1.logger.info(`Copy Message start: source=${String(sourceChatId)} messageId=${messageId} target=${String(targetChatId)}`);
    const fromPeer = await resolvePeer(client, sourceChatId);
    const toPeer = saveToSavedMessages ? 'me' : await resolvePeer(client, targetChatId);
    const messages = await (0, floodWaitHandler_1.safeExecute)(() => getMessagesLoose(client, fromPeer, { ids: [messageId] }));
    const originalMessage = messages[0];
    if (!originalMessage)
        throw new Error('Original message not found');
    const hasCustomCaption = !!caption && caption.trim() !== '';
    const messageContent = hasCustomCaption
        ? formattedCaptionInput.text || caption
        : getMessageText(originalMessage);
    let mediaToSend = originalMessage.media;
    if (mediaToSend &&
        (mediaToSend.className === 'MessageMediaWebPage' || mediaToSend._ === 'messageMediaWebPage')) {
        mediaToSend = undefined;
    }
    const result = await (0, rateLimiter_1.withRateLimit)(async () => (0, floodWaitHandler_1.safeExecute)(() => sendMessageLoose(client, toPeer, {
        message: messageContent,
        file: mediaToSend,
        linkPreview: !disableLinkPreview,
        parseMode: hasCustomCaption ? formattedCaptionInput.parseMode : undefined,
        formattingEntities: hasCustomCaption ? undefined : originalMessage.entities || [],
    })));
    logger_1.logger.info(`Copy Message success: source=${String(sourceChatId)} messageId=${messageId} copiedId=${result.id}`);
    let senderId = getPeerIdString(result.fromId);
    if (!senderId && originalMessage.fromId) {
        senderId = getPeerIdString(originalMessage.fromId);
    }
    if (!senderId && originalMessage.post_author)
        senderId = originalMessage.post_author;
    if (!senderId && originalMessage.peerId) {
        senderId = getPeerIdString(originalMessage.peerId);
    }
    return [
        {
            json: {
                success: true,
                message: 'Message copied successfully',
                copiedId: result.id,
                originalId: originalMessage.id,
                text: getRichMessageText(result),
                rawText: getMessageText(result),
                chatId: toIdString(result.chatId),
                fromId: senderId,
                date: result.date,
                hasMedia: !!mediaToSend,
                caption: caption || getRichMessageText(originalMessage),
                rawCaption: caption || getMessageText(originalMessage),
            },
            pairedItem: { item: i },
        },
    ];
}
async function resolvePeer(client, rawId) {
    if (isResolvablePeerObject(rawId)) {
        return rawId;
    }
    const normalizedRawId = normalizePeerReference(rawId);
    const asString = typeof normalizedRawId === 'string' ? normalizedRawId.trim() : String(normalizedRawId);
    if (!asString || asString.toLowerCase() === 'me')
        return 'me';
    const candidates = getInputReferenceAliases(asString);
    let initialError;
    try {
        const result = await client.getInputEntity(asString);
        if (result && typeof result === 'object') {
            if ('accessHash' in result && String(result.accessHash) === '0') {
                throw new Error('Dummy entity with 0 accessHash resolved; requires dialog search');
            }
            const isInputChat = result.className === 'InputPeerChat' ||
                result._ === 'inputPeerChat';
            if (isInputChat && /^\d+$/.test(asString)) {
                throw new Error('Dummy InputPeerChat parsed from positive string; requires dialog search');
            }
        }
        return result;
    }
    catch (error) {
        initialError = error;
    }
    try {
        for await (const dialog of iterDialogsLoose(client, { limit: 5000 })) {
            const entity = (dialog.entity || dialog);
            for (const candidate of candidates) {
                if (matchesEntityReference(entity, candidate)) {
                    return await client.getInputEntity(entity);
                }
            }
        }
    }
    catch {
    }
    if (/^\d+$/.test(asString)) {
        throw new Error(`Could not resolve Telegram entity for numeric ID ${asString}. ` +
            `If this is a channel/group from a previous node, pass its full chat ID (for example -100${asString}) or make sure it appears in this account's dialog list. ` +
            `If this is a user, Telegram also requires a cached access hash, so use their @username or interact with them first.`);
    }
    throw initialError || new Error(`Could not resolve Telegram entity: ${asString}`);
}
async function copyRestrictedContent(client, i) {
    var _a, _b, _c, _d, _e, _f, _g;
    const sourceChatId = this.getNodeParameter('sourceChatId', i);
    const messageId = this.getNodeParameter('messageId', i);
    const saveToSavedMessages = this.getNodeParameter('saveToSavedMessages', i, false);
    const includeCaption = this.getNodeParameter('includeCaption', i, true);
    const downloadTimeout = this.getNodeParameter('downloadTimeout', i, 60);
    const targetChatId = saveToSavedMessages
        ? ''
        : this.getNodeParameter('targetChatId', i);
    try {
        logger_1.logger.info(`Attempting to copy restricted message ${messageId} from chat ${sourceChatId}`);
        const messages = await getMessagesLoose(client, sourceChatId, {
            ids: [parseInt(messageId, 10)],
        });
        if (!messages || messages.length === 0) {
            throw new Error(`Message ${messageId} not found in chat ${sourceChatId}`);
        }
        const message = messages[0];
        if (!message) {
            throw new Error(`Message ${messageId} not found in chat ${sourceChatId}`);
        }
        if (!message.media && !message.text && !message.message) {
            throw new Error('Message has no content to copy');
        }
        const finalTargetChatId = saveToSavedMessages ? 'me' : targetChatId;
        let result;
        if ((_a = message.media) === null || _a === void 0 ? void 0 : _a.photo) {
            result = await handlePhoto(client, message, finalTargetChatId, {
                includeCaption,
                downloadTimeout,
            });
        }
        else if ((_b = message.media) === null || _b === void 0 ? void 0 : _b.video) {
            result = await handleVideo(client, message, finalTargetChatId, {
                includeCaption,
                downloadTimeout,
            });
        }
        else if ((_c = message.media) === null || _c === void 0 ? void 0 : _c.document) {
            result = await handleDocument(client, message, finalTargetChatId, {
                includeCaption,
                downloadTimeout,
            });
        }
        else if (message.sticker) {
            result = await handleSticker(client, message, finalTargetChatId, { downloadTimeout });
        }
        else if (message.voice) {
            result = await handleVoice(client, message, finalTargetChatId, {
                includeCaption,
                downloadTimeout,
            });
        }
        else if (message.audio) {
            result = await handleAudio(client, message, finalTargetChatId, {
                includeCaption,
                downloadTimeout,
            });
        }
        else if ((_d = message.media) === null || _d === void 0 ? void 0 : _d.geo) {
            result = await handleLocation(client, message, finalTargetChatId, { includeCaption });
        }
        else if ((_e = message.media) === null || _e === void 0 ? void 0 : _e.contact) {
            result = await handleContact(client, message, finalTargetChatId);
        }
        else if ((_f = message.media) === null || _f === void 0 ? void 0 : _f.poll) {
            result = await handlePoll(client, message, finalTargetChatId, { includeCaption });
        }
        else if ((_g = message.media) === null || _g === void 0 ? void 0 : _g.dice) {
            result = await handleDice(client, message, finalTargetChatId);
        }
        else if (message.text || message.message) {
            result = await handleText(client, message, finalTargetChatId, { includeCaption });
        }
        else {
            throw new Error(`Unsupported media type: ${JSON.stringify(message)}`);
        }
        return [
            {
                json: {
                    success: true,
                    message: 'Restricted content copied successfully',
                    messageId: result.id,
                    chatId: finalTargetChatId,
                    timestamp: result.date,
                    originalMessageId: messageId,
                    sourceChatId: sourceChatId,
                    mediaType: getMessageType(message),
                },
                pairedItem: { item: i },
            },
        ];
    }
    catch (error) {
        logger_1.logger.error('Failed to copy restricted content:', error);
        if (error.message.includes('FORBIDDEN') ||
            error.message.includes('RESTRICTED') ||
            error.message.includes('SAVING_CONTENT_RESTRICTED')) {
            throw (0, nodeOperationError_1.createNodeOperationError)(`Content is restricted and cannot be copied. Error: ${error.message}`, { context: this, itemIndex: i, cause: error });
        }
        throw (0, nodeOperationError_1.asNodeOperationError)(error, { context: this, itemIndex: i });
    }
}
async function readHistory(client, i) {
    const chatId = this.getNodeParameter('chatId', i);
    const messageId = Number(this.getNodeParameter('messageId', i));
    const entity = await getEntityLoose(client, chatId);
    const peer = await resolvePeer(client, chatId);
    const peerKind = detectPeerKind(entity, peer);
    if (peerKind === 'channel') {
        await client.invoke(new teleproto_1.Api.channels.ReadHistory({
            channel: peer,
            maxId: messageId,
        }));
    }
    else {
        await client.invoke(new teleproto_1.Api.messages.ReadHistory({
            peer: chatId,
            maxId: messageId,
        }));
    }
    return [
        {
            json: {
                success: true,
                chatId,
                messageId,
                message: 'Message marked as read successfully',
            },
            pairedItem: { item: i },
        },
    ];
}
async function downloadMediaWithTimeout(client, message, timeoutSeconds = 60) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error(`Download timeout after ${timeoutSeconds} seconds`));
        }, timeoutSeconds * 1000);
        client
            .downloadMedia(message, { stream: true })
            .then((stream) => {
            clearTimeout(timeout);
            resolve(stream);
        })
            .catch((error) => {
            clearTimeout(timeout);
            reject(error);
        });
    });
}
async function downloadMediaBuffer(client, message) {
    try {
        const result = await downloadMediaLoose(client, message, { stream: true });
        if (Buffer.isBuffer(result)) {
            return result;
        }
        if (result && typeof result === 'object' && 'on' in result && typeof result.on === 'function') {
            return new Promise((resolve, reject) => {
                const chunks = [];
                const stream = result;
                stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
                stream.on('end', () => resolve(Buffer.concat(chunks)));
                stream.on('error', reject);
            });
        }
        if (result &&
            typeof result === 'object' &&
            'getReader' in result &&
            typeof result.getReader === 'function') {
            const reader = result.getReader();
            const chunks = [];
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                chunks.push(value);
            }
            return Buffer.concat(chunks.map((c) => Buffer.from(c)));
        }
        return Buffer.from(String(result));
    }
    catch (error) {
        throw (0, nodeOperationError_1.createNodeOperationError)(`Failed to download media: ${error}`, { cause: error });
    }
}
function getFilename(message) {
    var _a, _b;
    const attributes = (_b = (_a = message.media) === null || _a === void 0 ? void 0 : _a.document) === null || _b === void 0 ? void 0 : _b.attributes;
    if (!attributes)
        return undefined;
    const filenameAttr = attributes.find((attribute) => attribute.className === 'DocumentAttributeFilename');
    return filenameAttr ? filenameAttr.fileName : undefined;
}
async function handlePhoto(client, message, targetChatId, options) {
    var _a;
    const caption = options.includeCaption ? getMessageText(message) : '';
    const photoMedia = (_a = message.media) === null || _a === void 0 ? void 0 : _a.photo;
    if (!photoMedia) {
        throw new Error('No photo found in message');
    }
    try {
        const inputPhoto = new teleproto_1.Api.InputPhoto({
            id: toBigIntValue(photoMedia.id),
            accessHash: toBigIntValue(photoMedia.accessHash),
            fileReference: toBytes(photoMedia.fileReference),
        });
        const inputMediaPhoto = new teleproto_1.Api.InputMediaPhoto({
            id: inputPhoto,
        });
        return (await client.invoke(new teleproto_1.Api.messages.SendMedia({
            peer: targetChatId,
            media: inputMediaPhoto,
            message: caption,
            randomId: (0, big_integer_1.default)(Math.floor(Math.random() * 1000000000)),
        })));
    }
    catch (forwardError) {
        const forwardErrorMessage = forwardError instanceof Error ? forwardError.message : String(forwardError);
        const isRestrictedError = forwardErrorMessage.includes('FORBIDDEN') ||
            forwardErrorMessage.includes('RESTRICTED') ||
            forwardErrorMessage.includes('CHAT_FORWARDS_RESTRICTED') ||
            forwardErrorMessage.includes('400');
        if (isRestrictedError) {
            logger_1.logger.info(`Direct photo forwarding restricted, falling back to download-and-upload`);
            const photoBuffer = await downloadMediaBuffer(client, message);
            const file = new uploads_1.CustomFile('photo.jpg', photoBuffer.length, '', photoBuffer);
            return await sendMessageLoose(client, targetChatId, {
                file: file,
                message: caption,
            });
        }
        throw (0, nodeOperationError_1.asNodeOperationError)(forwardError);
    }
}
async function handleVideo(client, message, targetChatId, options) {
    var _a, _b;
    const caption = options.includeCaption ? getMessageText(message) : '';
    const videoBuffer = await downloadMediaBuffer(client, message);
    const filename = getFilename(message) || `video_${Date.now()}.mp4`;
    const file = new uploads_1.CustomFile(filename, videoBuffer.length, '', videoBuffer);
    return await sendMessageLoose(client, targetChatId, {
        file: file,
        message: caption,
        formattingEntities: message.entities || [],
        attributes: (_b = (_a = message.media) === null || _a === void 0 ? void 0 : _a.document) === null || _b === void 0 ? void 0 : _b.attributes,
    });
}
async function handleDocument(client, message, targetChatId, options) {
    var _a, _b;
    const caption = options.includeCaption ? getMessageText(message) : '';
    const docBuffer = await downloadMediaBuffer(client, message);
    const filename = getFilename(message) || `document_${Date.now()}`;
    const file = new uploads_1.CustomFile(filename, docBuffer.length, '', docBuffer);
    return await sendMessageLoose(client, targetChatId, {
        file: file,
        message: caption,
        formattingEntities: message.entities || [],
        attributes: (_b = (_a = message.media) === null || _a === void 0 ? void 0 : _a.document) === null || _b === void 0 ? void 0 : _b.attributes,
    });
}
async function handleSticker(client, message, targetChatId, options) {
    const stickerStream = await downloadMediaWithTimeout(client, message, options.downloadTimeout);
    return await sendMessageLoose(client, targetChatId, {
        file: stickerStream,
    });
}
async function handleVoice(client, message, targetChatId, options) {
    var _a, _b;
    const caption = options.includeCaption ? getMessageText(message) : '';
    const voiceBuffer = await downloadMediaBuffer(client, message);
    const filename = getFilename(message) || `voice_${Date.now()}.ogg`;
    const file = new uploads_1.CustomFile(filename, voiceBuffer.length, '', voiceBuffer);
    return await sendMessageLoose(client, targetChatId, {
        file: file,
        message: caption,
        formattingEntities: message.entities || [],
        attributes: (_b = (_a = message.media) === null || _a === void 0 ? void 0 : _a.document) === null || _b === void 0 ? void 0 : _b.attributes,
    });
}
async function handleAudio(client, message, targetChatId, options) {
    var _a, _b;
    const caption = options.includeCaption ? getMessageText(message) : '';
    const audioBuffer = await downloadMediaBuffer(client, message);
    const filename = getFilename(message) || `audio_${Date.now()}.mp3`;
    const file = new uploads_1.CustomFile(filename, audioBuffer.length, '', audioBuffer);
    return await sendMessageLoose(client, targetChatId, {
        file: file,
        message: caption,
        formattingEntities: message.entities || [],
        attributes: (_b = (_a = message.media) === null || _a === void 0 ? void 0 : _a.document) === null || _b === void 0 ? void 0 : _b.attributes,
    });
}
async function handleLocation(client, message, targetChatId, options) {
    var _a, _b, _c, _d, _e, _f;
    const caption = options.includeCaption ? getMessageText(message) : '';
    return (await client.invoke(new teleproto_1.Api.messages.SendMedia({
        peer: targetChatId,
        media: new teleproto_1.Api.InputMediaGeoPoint({
            geoPoint: new teleproto_1.Api.InputGeoPoint({
                lat: (_c = (_b = (_a = message.media) === null || _a === void 0 ? void 0 : _a.geo) === null || _b === void 0 ? void 0 : _b.lat) !== null && _c !== void 0 ? _c : 0,
                long: (_f = (_e = (_d = message.media) === null || _d === void 0 ? void 0 : _d.geo) === null || _e === void 0 ? void 0 : _e.long) !== null && _f !== void 0 ? _f : 0,
            }),
        }),
        message: caption,
        randomId: (0, big_integer_1.default)(Math.floor(Math.random() * 1000000000)),
    })));
}
async function handleContact(client, message, targetChatId) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    return (await client.invoke(new teleproto_1.Api.messages.SendMedia({
        peer: targetChatId,
        media: new teleproto_1.Api.InputMediaContact({
            phoneNumber: ((_b = (_a = message.media) === null || _a === void 0 ? void 0 : _a.contact) === null || _b === void 0 ? void 0 : _b.phoneNumber) || '',
            firstName: ((_d = (_c = message.media) === null || _c === void 0 ? void 0 : _c.contact) === null || _d === void 0 ? void 0 : _d.firstName) || '',
            lastName: ((_f = (_e = message.media) === null || _e === void 0 ? void 0 : _e.contact) === null || _f === void 0 ? void 0 : _f.lastName) || '',
            vcard: ((_h = (_g = message.media) === null || _g === void 0 ? void 0 : _g.contact) === null || _h === void 0 ? void 0 : _h.vcard) || '',
        }),
        message: '',
        randomId: (0, big_integer_1.default)(Math.floor(Math.random() * 1000000000)),
    })));
}
async function handlePoll(client, message, targetChatId, options) {
    var _a, _b;
    const caption = options.includeCaption ? getMessageText(message) : '';
    const poll = message.poll || ((_a = message.media) === null || _a === void 0 ? void 0 : _a.poll);
    return (await client.invoke(new teleproto_1.Api.messages.SendMedia({
        peer: targetChatId,
        media: new teleproto_1.Api.InputMediaPoll({
            poll: new teleproto_1.Api.Poll({
                id: (0, big_integer_1.default)(Math.floor(Math.random() * 1000000000)),
                question: new teleproto_1.Api.TextWithEntities({
                    text: (poll === null || poll === void 0 ? void 0 : poll.question) || '',
                    entities: [],
                }),
                answers: ((_b = poll === null || poll === void 0 ? void 0 : poll.answers) === null || _b === void 0 ? void 0 : _b.map((answer, index) => new teleproto_1.Api.PollAnswer({
                    text: new teleproto_1.Api.TextWithEntities({
                        text: answer.text || '',
                        entities: [],
                    }),
                    option: Buffer.from(index.toString()),
                }))) || [],
                closed: false,
                publicVoters: poll === null || poll === void 0 ? void 0 : poll.publicVoters,
                multipleChoice: poll === null || poll === void 0 ? void 0 : poll.multipleChoice,
                quiz: poll === null || poll === void 0 ? void 0 : poll.quiz,
                hash: (0, big_integer_1.default)(0),
            }),
        }),
        message: caption,
        randomId: (0, big_integer_1.default)(Math.floor(Math.random() * 1000000000)),
    })));
}
async function handleDice(client, message, targetChatId) {
    var _a;
    return (await client.invoke(new teleproto_1.Api.messages.SendMedia({
        peer: targetChatId,
        media: new teleproto_1.Api.InputMediaDice({
            emoticon: ((_a = message.dice) === null || _a === void 0 ? void 0 : _a.emoji) || 'ðŸŽ²',
        }),
        message: '',
        randomId: (0, big_integer_1.default)(Math.floor(Math.random() * 1000000000)),
    })));
}
async function handleText(client, message, targetChatId, options) {
    const text = options.includeCaption ? getMessageText(message) : '';
    return await sendMessageLoose(client, targetChatId, {
        message: text,
        formattingEntities: message.entities || [],
    });
}
async function enrichHistoryStats(client, peer, chatEntity, messageIds, includeReactions, statsByMessageId) {
    var _a, _b, _c, _d, _e, _f, _g;
    if (messageIds.length === 0)
        return;
    const isChannel = (chatEntity === null || chatEntity === void 0 ? void 0 : chatEntity.className) === 'Channel' || chatEntity._ === 'channel';
    const idChunks = (0, operationHelpers_1.chunk)(messageIds, 100);
    for (const idChunk of idChunks) {
        let viewsResult;
        try {
            viewsResult = (await (0, rateLimiter_1.withRateLimit)(() => (0, floodWaitHandler_1.safeExecute)(() => client.invoke(new teleproto_1.Api.messages.GetMessagesViews({
                peer: peer,
                id: idChunk,
                increment: false,
            })))));
        }
        catch (error) {
            logger_1.logger.warn('getHistory includeStats: getMessagesViews failed for chunk, defaulting to nulls: ' +
                error.message);
        }
        if (!(viewsResult === null || viewsResult === void 0 ? void 0 : viewsResult.views) || viewsResult.views.length !== idChunk.length) {
            logger_1.logger.warn('getHistory includeStats: getMessagesViews returned length mismatch ' +
                `(got ${(_b = (_a = viewsResult === null || viewsResult === void 0 ? void 0 : viewsResult.views) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0}, expected ${idChunk.length}), defaulting chunk to nulls`);
            idChunk.forEach((msgId) => {
                statsByMessageId.set(msgId, {
                    views: null,
                    forwards: null,
                    repliesCount: null,
                    hasComments: false,
                });
            });
        }
        else {
            idChunk.forEach((msgId, index) => {
                var _a, _b, _c, _d, _e;
                const view = viewsResult.views[index];
                statsByMessageId.set(msgId, {
                    views: (_a = view === null || view === void 0 ? void 0 : view.views) !== null && _a !== void 0 ? _a : null,
                    forwards: (_b = view === null || view === void 0 ? void 0 : view.forwards) !== null && _b !== void 0 ? _b : null,
                    repliesCount: (_d = (_c = view === null || view === void 0 ? void 0 : view.replies) === null || _c === void 0 ? void 0 : _c.replies) !== null && _d !== void 0 ? _d : null,
                    hasComments: !!((_e = view === null || view === void 0 ? void 0 : view.replies) === null || _e === void 0 ? void 0 : _e.comments),
                });
            });
        }
        if (includeReactions) {
            try {
                let fullMessages;
                if (isChannel) {
                    const inputChannel = (_c = toInputChannel(peer)) !== null && _c !== void 0 ? _c : toInputChannel(chatEntity);
                    if (!inputChannel) {
                        logger_1.logger.warn('getHistory includeStats: cannot build InputChannel for channel reactions, ' +
                            'defaulting chunk to empty reactions');
                        idChunk.forEach((msgId) => {
                            const ex = statsByMessageId.get(msgId);
                            if (ex) {
                                if (ex.reactions === undefined) {
                                    ex.reactions = [];
                                    statsByMessageId.set(msgId, ex);
                                }
                            }
                            else {
                                statsByMessageId.set(msgId, {
                                    views: null,
                                    forwards: null,
                                    repliesCount: null,
                                    hasComments: false,
                                    reactions: [],
                                });
                            }
                        });
                        continue;
                    }
                    const chResult = await (0, rateLimiter_1.withRateLimit)(() => (0, floodWaitHandler_1.safeExecute)(() => client.invoke(new teleproto_1.Api.channels.GetMessages({
                        channel: inputChannel,
                        id: idChunk.map((mid) => new teleproto_1.Api.InputMessageID({ id: mid })),
                    }))));
                    fullMessages = ((_d = chResult.messages) !== null && _d !== void 0 ? _d : []);
                }
                else {
                    const msgResult = await (0, rateLimiter_1.withRateLimit)(() => (0, floodWaitHandler_1.safeExecute)(() => client.invoke(new teleproto_1.Api.messages.GetMessages({
                        id: idChunk.map((mid) => new teleproto_1.Api.InputMessageID({ id: mid })),
                    }))));
                    fullMessages = ((_e = msgResult.messages) !== null && _e !== void 0 ? _e : []);
                }
                for (const rawMsg of fullMessages) {
                    if (!rawMsg ||
                        rawMsg.className === 'MessageEmpty' ||
                        rawMsg._ === 'MessageEmpty') {
                        continue;
                    }
                    const msgId = rawMsg.id;
                    const existing = (_f = statsByMessageId.get(msgId)) !== null && _f !== void 0 ? _f : {
                        views: null,
                        forwards: null,
                        repliesCount: null,
                        hasComments: false,
                    };
                    const reactionResults = (_g = rawMsg.reactions) === null || _g === void 0 ? void 0 : _g.results;
                    existing.reactions = Array.isArray(reactionResults)
                        ? reactionResults.map((r) => {
                            var _a, _b, _c;
                            return ({
                                emoji: (_b = (_a = r.reaction) === null || _a === void 0 ? void 0 : _a.emoticon) !== null && _b !== void 0 ? _b : '',
                                count: (_c = r.count) !== null && _c !== void 0 ? _c : 0,
                            });
                        })
                        : [];
                    statsByMessageId.set(msgId, existing);
                }
            }
            catch (error) {
                logger_1.logger.warn('getHistory includeStats: reactions fetch failed for chunk, defaulting to empty: ' +
                    error.message);
                idChunk.forEach((msgId) => {
                    const existing = statsByMessageId.get(msgId);
                    if (existing) {
                        if (existing.reactions === undefined) {
                            existing.reactions = [];
                        }
                        statsByMessageId.set(msgId, existing);
                    }
                    else {
                        statsByMessageId.set(msgId, {
                            views: null,
                            forwards: null,
                            repliesCount: null,
                            hasComments: false,
                            reactions: [],
                        });
                    }
                });
            }
        }
    }
}
//# sourceMappingURL=message.operations.js.map