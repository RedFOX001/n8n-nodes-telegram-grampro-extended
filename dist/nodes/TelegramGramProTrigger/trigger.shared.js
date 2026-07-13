"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTriggerConfig = parseTriggerConfig;
exports.shouldProcessMessage = shouldProcessMessage;
exports.resolveMessageContext = resolveMessageContext;
exports.buildTriggerPayload = buildTriggerPayload;
exports.buildAlbumTriggerPayload = buildAlbumTriggerPayload;
exports.createExecutionItem = createExecutionItem;
exports.createAlbumExecutionItem = createAlbumExecutionItem;
exports.createAlbumDeduplicationKey = createAlbumDeduplicationKey;
exports.createDedupeTracker = createDedupeTracker;
exports.createMessageDeduplicationKey = createMessageDeduplicationKey;
const payloadBuilders_1 = require("../TelegramGramPro/core/payloadBuilders");
const ALL_UPDATES = [
    'message',
    'edited_message',
    'deleted_message',
    'user_update',
];
const ALL_LISTENING_MODES = ['incoming', 'outgoing'];
const DEDUPE_TTL_MS = 10 * 60 * 1000;
function parseTriggerConfig() {
    const updates = normalizeUpdates(this.getNodeParameter('updates', []));
    const listeningMode = normalizeListeningModes(this.getNodeParameter('listeningMode', []));
    const disableBinary = this.getNodeParameter('disableBinary', false);
    const filterMode = this.getNodeParameter('filterMode', '');
    const hasFilterMode = typeof filterMode === 'string' && filterMode.length > 0;
    const allMessages = hasFilterMode
        ? filterMode === 'all'
        : this.getNodeParameter('allMessages', true);
    const onlyUserMessages = hasFilterMode
        ? filterMode === 'onlyPrivate'
        : this.getNodeParameter('onlyUserMessages', false);
    const onlyChannelMessages = hasFilterMode
        ? filterMode === 'onlyChannels'
        : this.getNodeParameter('onlyChannelMessages', false);
    const onlyGroupMessages = hasFilterMode
        ? filterMode === 'onlyGroups'
        : this.getNodeParameter('onlyGroupMessages', false);
    const chatFilterMode = this.getNodeParameter('chatFilterMode', '');
    const hasChatFilterMode = typeof chatFilterMode === 'string' && chatFilterMode.length > 0;
    const selectedChatsOnly = hasChatFilterMode
        ? chatFilterMode === 'include'
        : this.getNodeParameter('selectedChatsOnly', false);
    const exceptSelectedChatsOnly = hasChatFilterMode
        ? chatFilterMode === 'exclude'
        : this.getNodeParameter('exceptSelectedChatsOnly', false);
    let selectedChats = [];
    if (selectedChatsOnly) {
        selectedChats = parseChatList(this, this.getNodeParameter('selectedChats', ''));
    }
    let exceptSelectedChats = [];
    if (exceptSelectedChatsOnly) {
        exceptSelectedChats = parseChatList(this, this.getNodeParameter('exceptSelectedChats', ''));
    }
    return {
        updates,
        listeningMode,
        disableBinary,
        allMessages,
        onlyUserMessages,
        onlyChannelMessages,
        onlyGroupMessages,
        exceptSelectedChatsOnly,
        exceptSelectedChats,
        selectedChatsOnly,
        selectedChats,
    };
}
function shouldProcessMessage(message, messageContext, config) {
    if (!matchesListeningMode(message, config.listeningMode)) {
        return false;
    }
    if (config.onlyUserMessages && !messageContext.isPrivateChat) {
        return false;
    }
    if (config.onlyChannelMessages && !messageContext.isChannelChat) {
        return false;
    }
    if (config.onlyGroupMessages && !messageContext.isGroupChat) {
        return false;
    }
    if (config.selectedChatsOnly && !matchesSelectedChat(messageContext, config.selectedChats)) {
        return false;
    }
    if (config.exceptSelectedChatsOnly &&
        matchesSelectedChat(messageContext, config.exceptSelectedChats)) {
        return false;
    }
    return true;
}
async function resolveMessageContext(message) {
    return (await (0, payloadBuilders_1.resolveMessageContext)(message));
}
function buildTriggerPayload(updateType, message, messageContext) {
    return (0, payloadBuilders_1.buildTriggerPayload)(updateType, message, messageContext);
}
function buildAlbumTriggerPayload(updateType, messages, messageContext) {
    return (0, payloadBuilders_1.buildAlbumTriggerPayload)(updateType, messages, messageContext);
}
async function createExecutionItem(context, message, payload, disableBinary) {
    return (0, payloadBuilders_1.createSharedBinaryExecutionItem)(context, [message], payload, disableBinary);
}
async function createAlbumExecutionItem(context, messages, payload, disableBinary) {
    return (0, payloadBuilders_1.createSharedBinaryExecutionItem)(context, messages, payload, disableBinary);
}
function createAlbumDeduplicationKey(updateType, messages) {
    var _a, _b, _c, _d;
    const first = messages[0];
    const last = messages[messages.length - 1];
    const gid = (_b = (_a = first.groupedId) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : 'none';
    return [
        updateType,
        gid,
        messages.length,
        first.id,
        last.id,
        (_d = (_c = first.chatId) === null || _c === void 0 ? void 0 : _c.toString()) !== null && _d !== void 0 ? _d : 'unknown',
    ].join(':');
}
function createDedupeTracker() {
    const seenKeys = new Map();
    return {
        shouldEmit(key) {
            const now = Date.now();
            cleanupExpiredKeys(seenKeys, now);
            if (seenKeys.has(key)) {
                return false;
            }
            seenKeys.set(key, now);
            return true;
        },
    };
}
function createMessageDeduplicationKey(updateType, message) {
    var _a, _b, _c, _d;
    return [
        updateType,
        (_b = (_a = message.chatId) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : 'unknown-chat',
        String(message.id),
        String((_d = (_c = message.editDate) !== null && _c !== void 0 ? _c : message.date) !== null && _d !== void 0 ? _d : 0),
        message.out ? 'out' : 'in',
    ].join(':');
}
function normalizeUpdates(value) {
    if (!Array.isArray(value)) {
        return ['message'];
    }
    const parsed = value.filter((entry) => typeof entry === 'string' && ALL_UPDATES.includes(entry));
    return parsed.length > 0 ? parsed : ['message'];
}
function normalizeListeningModes(value) {
    if (!Array.isArray(value)) {
        return [...ALL_LISTENING_MODES];
    }
    const parsed = value.filter((entry) => typeof entry === 'string' && ALL_LISTENING_MODES.includes(entry));
    return parsed.length > 0 ? parsed : [...ALL_LISTENING_MODES];
}
function matchesListeningMode(message, listeningMode) {
    const direction = message.out ? 'outgoing' : 'incoming';
    return listeningMode.includes(direction);
}
function parseChatList(context, rawChatList) {
    if (typeof rawChatList !== 'string') {
        return [];
    }
    try {
        let parsed;
        try {
            parsed = JSON.parse(rawChatList);
        }
        catch {
            parsed = rawChatList;
        }
        if (typeof parsed === 'string' || typeof parsed === 'number' || typeof parsed === 'bigint') {
            return normalizeChatEntries([parsed]);
        }
        if (!Array.isArray(parsed)) {
            const parts = String(rawChatList)
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            return normalizeChatEntries(parts);
        }
        return normalizeChatEntries(parsed);
    }
    catch {
        return [];
    }
}
function normalizeChatEntries(values) {
    const expanded = new Set();
    for (const value of values) {
        const normalized = normalizeMatchValue(value);
        if (!normalized) {
            continue;
        }
        for (const alias of expandIdAliases(normalized)) {
            expanded.add(alias);
        }
    }
    return Array.from(expanded);
}
function matchesSelectedChat(messageContext, selectedChats) {
    const candidates = new Set();
    for (const value of [
        messageContext.chatId,
        messageContext.senderId,
        messageContext.chatName,
        messageContext.chatUsername,
        messageContext.senderName,
        messageContext.senderUsername,
    ]) {
        const normalized = normalizeMatchValue(value);
        if (!normalized) {
            continue;
        }
        candidates.add(normalized);
        for (const alias of expandIdAliases(normalized)) {
            candidates.add(alias);
        }
    }
    return selectedChats.some((entry) => candidates.has(entry));
}
function normalizeMatchValue(value) {
    let rawValue = null;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
        rawValue = String(value);
    }
    else if (typeof value === 'object' && value !== null && 'toString' in value) {
        rawValue = value.toString();
    }
    if (rawValue === null)
        return null;
    const normalized = rawValue.trim().toLowerCase();
    if (!normalized)
        return null;
    return normalized.startsWith('@') ? normalized.slice(1) : normalized;
}
function expandIdAliases(value) {
    const aliases = new Set([value]);
    if (!/^-?\d+$/.test(value)) {
        return Array.from(aliases);
    }
    if (value.startsWith('-100') && value.length > 4) {
        const bareValue = value.slice(4);
        aliases.add(bareValue);
        aliases.add(`-${bareValue}`);
        return Array.from(aliases);
    }
    if (value.startsWith('-')) {
        const bareValue = value.slice(1);
        aliases.add(bareValue);
        aliases.add(`-100${bareValue}`);
        return Array.from(aliases);
    }
    aliases.add(`-${value}`);
    aliases.add(`-100${value}`);
    return Array.from(aliases);
}
function cleanupExpiredKeys(seenKeys, now) {
    for (const [key, seenAt] of seenKeys.entries()) {
        if (now - seenAt > DEDUPE_TTL_MS) {
            seenKeys.delete(key);
        }
    }
}
//# sourceMappingURL=trigger.shared.js.map