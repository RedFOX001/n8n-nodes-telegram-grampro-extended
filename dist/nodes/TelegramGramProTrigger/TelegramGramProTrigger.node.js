"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramGramProTrigger = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const teleproto_1 = require("teleproto");
const Album_1 = require("teleproto/events/Album");
const EditedMessage_1 = require("teleproto/events/EditedMessage");
const NewMessage_1 = require("teleproto/events/NewMessage");
const DeletedMessage_1 = require("teleproto/events/DeletedMessage");
const UserUpdate_1 = require("teleproto/events/UserUpdate");
const TelegramGramProApi_credentials_1 = require("../../credentials/TelegramGramProApi.credentials");
const clientManager_1 = require("../TelegramGramPro/core/clientManager");
const logger_1 = require("../TelegramGramPro/core/logger");
const payloadBuilders_1 = require("../TelegramGramPro/core/payloadBuilders");
const trigger_shared_1 = require("./trigger.shared");
const MESSAGE_SNAPSHOT_TTL_MS = 6 * 60 * 60 * 1000;
const MESSAGE_SNAPSHOT_MAX_SIZE = 5000;
class TelegramGramProTrigger {
    constructor() {
        this.description = {
            displayName: 'Telegram GramPro Trigger',
            name: 'telegramGramProTrigger',
            icon: 'file:telegram-grampro.svg',
            group: ['trigger'],
            version: 1,
            subtitle: '=Updates: {{$parameter["updates"].join(", ")}}',
            description: 'Starts the workflow on Telegram user account updates',
            defaults: {
                name: 'Telegram GramPro Trigger',
            },
            codex: {
                categories: ['Communication'],
                alias: ['Telegram GramPro Trigger', 'GramPro Trigger'],
                resources: {
                    credentialDocumentation: [
                        {
                            url: 'https://github.com/sadiakant/n8n-nodes-telegram-grampro/blob/main/docs/AUTHORIZATION_GUIDE.md',
                        },
                    ],
                    primaryDocumentation: [
                        {
                            url: 'https://github.com/sadiakant/n8n-nodes-telegram-grampro/blob/main/docs/OPERATIONS_GUIDE.md',
                        },
                    ],
                },
            },
            inputs: [],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            credentials: [
                {
                    name: 'telegramGramProApi',
                    required: true,
                    testedBy: 'testTelegramApi',
                },
            ],
            properties: [
                {
                    displayName: 'Telegram user accounts do not support Bot API webhooks. This trigger keeps your MTProto session connected while the workflow is active.',
                    name: 'userAccountNotice',
                    type: 'notice',
                    default: '',
                },
                {
                    displayName: 'Trigger On',
                    name: 'updates',
                    type: 'multiOptions',
                    required: true,
                    default: ['message'],
                    options: [
                        {
                            name: 'Message',
                            value: 'message',
                            description: 'Trigger on new messages from private chats, bots, groups, supergroups, or channels',
                        },
                        {
                            name: 'Edited Message',
                            value: 'edited_message',
                            description: 'Trigger when an existing message visible to the account is edited',
                        },
                        {
                            name: 'Deleted Message',
                            value: 'deleted_message',
                            description: 'Trigger when a message is deleted (teleproto feature)',
                        },
                        {
                            name: 'User Update',
                            value: 'user_update',
                            description: 'Trigger when a user goes online, offline, or changes status (teleproto feature)',
                        },
                    ],
                },
                {
                    displayName: 'Listening Mode',
                    name: 'listeningMode',
                    type: 'multiOptions',
                    required: true,
                    default: ['incoming', 'outgoing'],
                    options: [
                        {
                            name: 'Incoming Messages',
                            value: 'incoming',
                            description: 'Listen only for incoming messages',
                        },
                        {
                            name: 'Outgoing Messages',
                            value: 'outgoing',
                            description: 'Listen only for outgoing messages',
                        },
                    ],
                },
                {
                    displayName: 'Disable Binary',
                    name: 'disableBinary',
                    type: 'boolean',
                    default: true,
                    description: 'Whether to skip downloading media binaries and return only media metadata in JSON',
                },
                {
                    displayName: 'All Messages',
                    name: 'allMessages',
                    type: 'boolean',
                    default: true,
                    displayOptions: {
                        show: {
                            onlyUserMessages: [false],
                            onlyChannelMessages: [false],
                            onlyGroupMessages: [false],
                            selectedChatsOnly: [false],
                        },
                    },
                    description: 'Whether to capture all messages from users, bots, groups, supergroups, and channels',
                },
                {
                    displayName: 'Only User Messages',
                    name: 'onlyUserMessages',
                    type: 'boolean',
                    default: false,
                    displayOptions: {
                        hide: {
                            selectedChatsOnly: [true],
                        },
                    },
                    description: 'Whether to capture only private user or bot messages',
                },
                {
                    displayName: 'Only Channel Messages',
                    name: 'onlyChannelMessages',
                    type: 'boolean',
                    default: false,
                    displayOptions: {
                        hide: {
                            selectedChatsOnly: [true],
                        },
                    },
                    description: 'Whether to capture only broadcast channel messages or posts',
                },
                {
                    displayName: 'Only Group Messages',
                    name: 'onlyGroupMessages',
                    type: 'boolean',
                    default: false,
                    displayOptions: {
                        hide: {
                            selectedChatsOnly: [true],
                        },
                    },
                    description: 'Whether to capture only group, supergroup, and gigagroup messages',
                },
                {
                    displayName: 'Selected Chats Only',
                    name: 'selectedChatsOnly',
                    type: 'boolean',
                    default: false,
                    displayOptions: {
                        hide: {
                            onlyUserMessages: [true],
                            onlyChannelMessages: [true],
                            onlyGroupMessages: [true],
                        },
                    },
                    description: 'Whether to capture messages only when the chat or sender matches your selected list (this disables All Messages)',
                },
                {
                    displayName: 'Except Selected Chats Only',
                    name: 'exceptSelectedChatsOnly',
                    type: 'boolean',
                    default: false,
                    description: 'Whether to ignore messages when the chat or sender matches your excluded list',
                },
                {
                    displayName: 'Selected Chats',
                    name: 'selectedChats',
                    type: 'string',
                    default: '[]',
                    displayOptions: {
                        show: {
                            selectedChatsOnly: [true],
                        },
                    },
                    description: 'JSON array of chat IDs, usernames, or names to match. Example: ["group1","user1","@username","-100123456789","1122334455"].',
                },
                {
                    displayName: 'Except Selected Chats',
                    name: 'exceptSelectedChats',
                    type: 'string',
                    default: '[]',
                    displayOptions: {
                        show: {
                            exceptSelectedChatsOnly: [true],
                        },
                    },
                    description: 'JSON array of chat IDs, usernames, or names to ignore. Example: ["username1","channel1","channel2","group1"].',
                },
            ],
            usableAsTool: true,
        };
        this.methods = {
            credentialTest: {
                testTelegramApi: TelegramGramProApi_credentials_1.testTelegramApi,
            },
        };
    }
    async trigger() {
        const credentials = (await this.getCredentials('telegramGramProApi'));
        if (!credentials) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Telegram GramPro credentials are required.');
        }
        const config = trigger_shared_1.parseTriggerConfig.call(this);
        const client = await (0, clientManager_1.getClient)(credentials.apiId, credentials.apiHash, credentials.session, {
            receiveUpdates: true,
            cacheClient: true,
            verifyAuthorization: true,
            autoReconnect: true,
        }, 'trigger');
        if (!client.connected) {
            await client.connect();
        }
        const dedupe = (0, trigger_shared_1.createDedupeTracker)();
        const messageSnapshots = createMessageSnapshotStore();
        const handlers = [];
        for (const updateType of config.updates) {
            const registration = createRegistration(updateType, async (items) => {
                this.emit([items]);
            }, this, client, config, dedupe, messageSnapshots);
            client.addEventHandler(registration.handler, registration.event);
            handlers.push(registration);
            if (updateType === 'message') {
                const albumRegistration = createAlbumRegistration(async (items) => {
                    this.emit([items]);
                }, this, client, config, dedupe, messageSnapshots);
                client.addEventHandler(albumRegistration.handler, albumRegistration.event);
                handlers.push(albumRegistration);
            }
        }
        const includesDeleted = config.updates.includes('deleted_message');
        const includesMessage = config.updates.includes('message');
        const includesEdited = config.updates.includes('edited_message');
        if (includesDeleted && !includesMessage) {
            const cacheMessageRegistration = createRegistration('message', async () => { }, this, client, config, dedupe, messageSnapshots, false);
            client.addEventHandler(cacheMessageRegistration.handler, cacheMessageRegistration.event);
            handlers.push(cacheMessageRegistration);
            const cacheAlbumRegistration = createAlbumRegistration(async () => { }, this, client, config, dedupe, messageSnapshots, false);
            client.addEventHandler(cacheAlbumRegistration.handler, cacheAlbumRegistration.event);
            handlers.push(cacheAlbumRegistration);
        }
        if (includesDeleted && !includesEdited) {
            const cacheEditedRegistration = createRegistration('edited_message', async () => { }, this, client, config, dedupe, messageSnapshots, false);
            client.addEventHandler(cacheEditedRegistration.handler, cacheEditedRegistration.event);
            handlers.push(cacheEditedRegistration);
        }
        logger_1.logger.info('[TelegramGramProTrigger] Trigger activated', {
            nodeName: this.getNode().name,
            updates: config.updates.join(','),
            listeningMode: config.listeningMode.join(','),
            allMessages: config.allMessages,
            disableBinary: config.disableBinary,
            exceptSelectedChatsOnly: config.exceptSelectedChatsOnly,
            selectedChatsOnly: config.selectedChatsOnly,
        });
        return {
            closeFunction: async () => {
                for (const { handler, event } of handlers) {
                    try {
                        client.removeEventHandler(handler, event);
                    }
                    catch (error) {
                        logger_1.logger.warn('[TelegramGramProTrigger] Failed to remove event handler', {
                            error: getErrorMessage(error),
                            updateEvent: event.constructor.name,
                        });
                    }
                }
                if (client.listEventHandlers().length === 0) {
                    try {
                        const apiId = typeof credentials.apiId === 'string'
                            ? Number.parseInt(credentials.apiId, 10)
                            : credentials.apiId;
                        await (0, clientManager_1.disconnectClient)(apiId, credentials.session, 'trigger');
                    }
                    catch (error) {
                        logger_1.logger.warn('[TelegramGramProTrigger] Failed to disconnect update client', {
                            error: getErrorMessage(error),
                        });
                    }
                }
                logger_1.logger.info('[TelegramGramProTrigger] Trigger deactivated', {
                    nodeName: this.getNode().name,
                });
            },
        };
    }
}
exports.TelegramGramProTrigger = TelegramGramProTrigger;
function createRegistration(updateType, emit, context, client, config, dedupe, messageSnapshots, emitEvents = true) {
    const processEvent = async (event, currentUpdateType) => {
        try {
            const message = event.message;
            if (!(message instanceof teleproto_1.Api.Message)) {
                return;
            }
            if (currentUpdateType === 'message' && message.groupedId && emitEvents) {
                return;
            }
            const dedupeKey = (0, trigger_shared_1.createMessageDeduplicationKey)(currentUpdateType, message);
            if (!dedupe.shouldEmit(dedupeKey)) {
                return;
            }
            const messageContext = await (0, trigger_shared_1.resolveMessageContext)(message);
            const payload = (0, trigger_shared_1.buildTriggerPayload)(currentUpdateType, message, messageContext);
            messageSnapshots.remember(payload);
            if (!emitEvents) {
                return;
            }
            if (!(0, trigger_shared_1.shouldProcessMessage)(message, messageContext, config)) {
                return;
            }
            const item = await (0, trigger_shared_1.createExecutionItem)(context, message, payload, config.disableBinary);
            await emit([item]);
        }
        catch (error) {
            logger_1.logger.error('[TelegramGramProTrigger] Failed to process Telegram update', {
                error: getErrorMessage(error),
                updateType: currentUpdateType,
                nodeName: context.getNode().name,
            });
        }
    };
    if (updateType === 'edited_message') {
        const event = new EditedMessage_1.EditedMessage({});
        const handler = (...args) => {
            void processEvent(args[0], 'edited_message');
        };
        return {
            event,
            handler,
        };
    }
    if (updateType === 'deleted_message') {
        const event = new DeletedMessage_1.DeletedMessage({});
        const handler = (...args) => {
            void (async () => {
                const deletedEvent = args[0];
                try {
                    const payload = await buildDeletedMessagePayload(deletedEvent, messageSnapshots, client);
                    await emit([{ json: payload }]);
                }
                catch (error) {
                    logger_1.logger.error('[TelegramGramProTrigger] Failed to process deleted message update', {
                        error: getErrorMessage(error),
                        updateType: 'deleted_message',
                        nodeName: context.getNode().name,
                    });
                }
            })();
        };
        return {
            event,
            handler,
        };
    }
    if (updateType === 'user_update') {
        const event = new UserUpdate_1.UserUpdate({});
        const handler = (...args) => {
            void (async () => {
                const userEvent = args[0];
                try {
                    const payload = await (0, payloadBuilders_1.buildUserUpdatePayload)(userEvent);
                    await emit([{ json: payload }]);
                }
                catch (error) {
                    logger_1.logger.error('[TelegramGramProTrigger] Failed to process user update', {
                        error: getErrorMessage(error),
                        updateType: 'user_update',
                        nodeName: context.getNode().name,
                    });
                }
            })();
        };
        return {
            event,
            handler,
        };
    }
    const event = new NewMessage_1.NewMessage({});
    const handler = (...args) => {
        void processEvent(args[0], 'message');
    };
    return {
        event,
        handler,
    };
}
function createAlbumRegistration(emit, context, client, config, dedupe, messageSnapshots, emitEvents = true) {
    const event = new Album_1.Album({});
    const handler = (...args) => {
        void processAlbumEvent(args[0], emit, context, client, config, dedupe, messageSnapshots, emitEvents);
    };
    return {
        event,
        handler,
    };
}
async function processAlbumEvent(event, emit, context, client, config, dedupe, messageSnapshots, emitEvents = true) {
    var _a;
    try {
        const messages = event.messages.filter((message) => message instanceof teleproto_1.Api.Message);
        if (messages.length === 0) {
            return;
        }
        const primaryMessage = (_a = messages.find((message) => { var _a, _b; return ((_b = (_a = message.message) !== null && _a !== void 0 ? _a : message.text) !== null && _b !== void 0 ? _b : '').trim(); })) !== null && _a !== void 0 ? _a : messages[0];
        const dedupeKey = (0, trigger_shared_1.createAlbumDeduplicationKey)('message', messages);
        if (!dedupe.shouldEmit(dedupeKey)) {
            return;
        }
        const messageContext = await (0, trigger_shared_1.resolveMessageContext)(primaryMessage);
        const payload = (0, trigger_shared_1.buildAlbumTriggerPayload)('message', messages, messageContext);
        for (const albumMessage of messages) {
            const albumMessagePayload = (0, trigger_shared_1.buildTriggerPayload)('message', albumMessage, messageContext);
            messageSnapshots.remember(albumMessagePayload);
        }
        if (!emitEvents) {
            return;
        }
        if (!(0, trigger_shared_1.shouldProcessMessage)(primaryMessage, messageContext, config)) {
            return;
        }
        const item = await (0, trigger_shared_1.createAlbumExecutionItem)(context, messages, payload, config.disableBinary);
        await emit([item]);
    }
    catch (error) {
        logger_1.logger.error('[TelegramGramProTrigger] Failed to process Telegram album update', {
            error: getErrorMessage(error),
            nodeName: context.getNode().name,
        });
    }
}
function createMessageSnapshotStore() {
    const byId = new Map();
    const byChatAndId = new Map();
    const cleanup = () => {
        const now = Date.now();
        for (const [key, entry] of byId.entries()) {
            if (now - entry.timestamp > MESSAGE_SNAPSHOT_TTL_MS) {
                byId.delete(key);
            }
        }
        for (const [key, entry] of byChatAndId.entries()) {
            if (now - entry.timestamp > MESSAGE_SNAPSHOT_TTL_MS) {
                byChatAndId.delete(key);
            }
        }
        trimMap(byId, MESSAGE_SNAPSHOT_MAX_SIZE);
        trimMap(byChatAndId, MESSAGE_SNAPSHOT_MAX_SIZE);
    };
    return {
        remember(payload) {
            const messageId = normalizeMessageId(payload.messageId);
            if (!messageId) {
                return;
            }
            const snapshot = {
                payload: { ...payload },
                timestamp: Date.now(),
            };
            byId.set(messageId, snapshot);
            const chatId = typeof payload.chatId === 'string' ? payload.chatId : null;
            if (chatId) {
                for (const alias of expandNumericIdAliases(chatId)) {
                    byChatAndId.set(`${alias}:${messageId}`, snapshot);
                }
            }
            cleanup();
        },
        get(deletedEvent) {
            cleanup();
            const eventChatId = getDeletedEventChatId(deletedEvent);
            const deletedIds = Array.isArray(deletedEvent.deletedIds) ? deletedEvent.deletedIds : [];
            for (const deletedId of deletedIds) {
                const messageId = String(deletedId);
                if (eventChatId) {
                    for (const alias of expandNumericIdAliases(eventChatId)) {
                        const scoped = byChatAndId.get(`${alias}:${messageId}`);
                        if (scoped) {
                            return scoped.payload;
                        }
                    }
                }
                const generic = byId.get(messageId);
                if (generic) {
                    return generic.payload;
                }
            }
            return undefined;
        },
        async waitFor(deletedEvent, timeoutMs = 800, intervalMs = 80) {
            const startedAt = Date.now();
            while (Date.now() - startedAt <= timeoutMs) {
                const snapshot = this.get(deletedEvent);
                if (snapshot) {
                    return snapshot;
                }
                await sleep(intervalMs);
            }
            return undefined;
        },
    };
}
function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function normalizeMessageId(value) {
    if (typeof value === 'string' && value.trim()) {
        return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }
    return null;
}
function trimMap(map, maxSize) {
    if (map.size <= maxSize) {
        return;
    }
    const overflow = map.size - maxSize;
    const keys = map.keys();
    for (let i = 0; i < overflow; i += 1) {
        const next = keys.next();
        if (next.done) {
            return;
        }
        map.delete(next.value);
    }
}
async function buildDeletedMessagePayload(deletedEvent, messageSnapshots, client) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const deletedIds = Array.isArray(deletedEvent.deletedIds) ? deletedEvent.deletedIds : [];
    const firstDeletedId = deletedIds[0];
    const snapshot = (_a = messageSnapshots.get(deletedEvent)) !== null && _a !== void 0 ? _a : (await messageSnapshots.waitFor(deletedEvent));
    const chatInfo = await resolveDeletedEventChatInfo(deletedEvent, snapshot, client);
    const date = new Date().toISOString();
    const senderFallbackName = chatInfo.chatType === 'user' || chatInfo.chatType === 'bot' || chatInfo.chatType === 'channel'
        ? chatInfo.chatName
        : null;
    const senderFallbackId = chatInfo.chatType === 'user' || chatInfo.chatType === 'bot' ? chatInfo.chatId : null;
    return {
        updateType: 'deleted_message',
        date,
        editDate: null,
        deletedIds,
        deletedCount: deletedIds.length,
        deletedId: firstDeletedId,
        messageId: firstDeletedId ? String(firstDeletedId) : undefined,
        groupedId: snapshot === null || snapshot === void 0 ? void 0 : snapshot.groupedId,
        mediaCount: snapshot === null || snapshot === void 0 ? void 0 : snapshot.mediaCount,
        message: snapshot === null || snapshot === void 0 ? void 0 : snapshot.message,
        rawMessage: snapshot === null || snapshot === void 0 ? void 0 : snapshot.rawMessage,
        chatName: (_b = chatInfo.chatName) !== null && _b !== void 0 ? _b : senderFallbackName,
        chatId: chatInfo.chatId,
        chatType: chatInfo.chatType,
        senderName: (_c = snapshot === null || snapshot === void 0 ? void 0 : snapshot.senderName) !== null && _c !== void 0 ? _c : senderFallbackName,
        senderId: (_d = snapshot === null || snapshot === void 0 ? void 0 : snapshot.senderId) !== null && _d !== void 0 ? _d : senderFallbackId,
        senderIsBot: (_e = snapshot === null || snapshot === void 0 ? void 0 : snapshot.senderIsBot) !== null && _e !== void 0 ? _e : null,
        isPrivate: (_f = chatInfo.isPrivate) !== null && _f !== void 0 ? _f : false,
        isGroup: (_g = chatInfo.isGroup) !== null && _g !== void 0 ? _g : false,
        isChannel: chatInfo.isChannel,
        isOutgoing: snapshot === null || snapshot === void 0 ? void 0 : snapshot.isOutgoing,
        messageType: (_h = snapshot === null || snapshot === void 0 ? void 0 : snapshot.messageType) !== null && _h !== void 0 ? _h : 'other',
        hasMedia: (_j = snapshot === null || snapshot === void 0 ? void 0 : snapshot.hasMedia) !== null && _j !== void 0 ? _j : false,
        fileName: snapshot === null || snapshot === void 0 ? void 0 : snapshot.fileName,
        fileExtension: snapshot === null || snapshot === void 0 ? void 0 : snapshot.fileExtension,
        mimeType: snapshot === null || snapshot === void 0 ? void 0 : snapshot.mimeType,
        size: snapshot === null || snapshot === void 0 ? void 0 : snapshot.size,
        bytes: snapshot === null || snapshot === void 0 ? void 0 : snapshot.bytes,
        mediaFiles: snapshot === null || snapshot === void 0 ? void 0 : snapshot.mediaFiles,
        hasWebPreview: snapshot === null || snapshot === void 0 ? void 0 : snapshot.hasWebPreview,
        mediaDownloadError: snapshot === null || snapshot === void 0 ? void 0 : snapshot.mediaDownloadError,
    };
}
async function resolveDeletedEventChatInfo(deletedEvent, snapshot, client) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const fallbackChatId = (_b = (_a = getDeletedEventChatId(deletedEvent)) !== null && _a !== void 0 ? _a : snapshot === null || snapshot === void 0 ? void 0 : snapshot.chatId) !== null && _b !== void 0 ? _b : null;
    const fallbackIsPrivate = (_c = snapshot === null || snapshot === void 0 ? void 0 : snapshot.isPrivate) !== null && _c !== void 0 ? _c : deletedEvent.isPrivate;
    const fallbackIsGroup = (_d = snapshot === null || snapshot === void 0 ? void 0 : snapshot.isGroup) !== null && _d !== void 0 ? _d : deletedEvent.isGroup;
    const fallbackIsChannel = Boolean(snapshot === null || snapshot === void 0 ? void 0 : snapshot.isChannel) || deletedEvent.isChannel;
    const fallbackChatType = (_e = snapshot === null || snapshot === void 0 ? void 0 : snapshot.chatType) !== null && _e !== void 0 ? _e : (fallbackIsChannel
        ? 'channel'
        : fallbackIsGroup
            ? 'group'
            : fallbackIsPrivate
                ? 'user'
                : 'unknown');
    try {
        const chat = await deletedEvent.getChat();
        if (!chat) {
            return {
                chatName: (_f = snapshot === null || snapshot === void 0 ? void 0 : snapshot.chatName) !== null && _f !== void 0 ? _f : null,
                chatId: fallbackChatId,
                chatType: fallbackChatType,
                isPrivate: fallbackIsPrivate,
                isGroup: fallbackIsGroup,
                isChannel: fallbackIsChannel,
            };
        }
        if (chat instanceof teleproto_1.Api.User) {
            const name = [chat.firstName, chat.lastName].filter(Boolean).join(' ').trim();
            return {
                chatName: name || chat.username || null,
                chatId: fallbackChatId !== null && fallbackChatId !== void 0 ? fallbackChatId : String(chat.id),
                chatType: chat.bot ? 'bot' : 'user',
                isPrivate: true,
                isGroup: false,
                isChannel: false,
            };
        }
        if (chat instanceof teleproto_1.Api.Chat || chat instanceof teleproto_1.Api.ChatEmpty) {
            const title = chat instanceof teleproto_1.Api.Chat ? chat.title : null;
            return {
                chatName: title !== null && title !== void 0 ? title : null,
                chatId: fallbackChatId,
                chatType: 'group',
                isPrivate: false,
                isGroup: true,
                isChannel: false,
            };
        }
        if (chat instanceof teleproto_1.Api.Channel || chat instanceof teleproto_1.Api.ChannelForbidden) {
            const isBroadcast = chat instanceof teleproto_1.Api.Channel ? Boolean(chat.broadcast) : true;
            const title = (_g = chat.title) !== null && _g !== void 0 ? _g : null;
            return {
                chatName: title,
                chatId: fallbackChatId,
                chatType: isBroadcast ? 'channel' : 'supergroup',
                isPrivate: false,
                isGroup: !isBroadcast,
                isChannel: true,
            };
        }
    }
    catch {
    }
    if (client && fallbackChatId) {
        try {
            const entity = (await client.getEntity(fallbackChatId));
            if (entity instanceof teleproto_1.Api.User) {
                const name = [entity.firstName, entity.lastName].filter(Boolean).join(' ').trim();
                return {
                    chatName: name || entity.username || null,
                    chatId: fallbackChatId !== null && fallbackChatId !== void 0 ? fallbackChatId : String(entity.id),
                    chatType: entity.bot ? 'bot' : 'user',
                    isPrivate: true,
                    isGroup: false,
                    isChannel: false,
                };
            }
            if (entity instanceof teleproto_1.Api.Chat || entity instanceof teleproto_1.Api.ChatForbidden) {
                return {
                    chatName: (_h = entity.title) !== null && _h !== void 0 ? _h : null,
                    chatId: fallbackChatId,
                    chatType: 'group',
                    isPrivate: false,
                    isGroup: true,
                    isChannel: false,
                };
            }
            if (entity instanceof teleproto_1.Api.Channel || entity instanceof teleproto_1.Api.ChannelForbidden) {
                const isBroadcast = entity instanceof teleproto_1.Api.Channel ? Boolean(entity.broadcast) : true;
                return {
                    chatName: (_j = entity.title) !== null && _j !== void 0 ? _j : null,
                    chatId: fallbackChatId,
                    chatType: isBroadcast ? 'channel' : 'supergroup',
                    isPrivate: false,
                    isGroup: !isBroadcast,
                    isChannel: true,
                };
            }
        }
        catch {
        }
    }
    return {
        chatName: (_k = snapshot === null || snapshot === void 0 ? void 0 : snapshot.chatName) !== null && _k !== void 0 ? _k : null,
        chatId: fallbackChatId,
        chatType: fallbackChatType,
        isPrivate: fallbackIsPrivate,
        isGroup: fallbackIsGroup,
        isChannel: fallbackIsChannel,
    };
}
async function sleep(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}
function getDeletedEventChatId(deletedEvent) {
    const originalUpdate = deletedEvent.originalUpdate;
    if (originalUpdate instanceof teleproto_1.Api.UpdateDeleteChannelMessages) {
        return normalizeDeletedChannelId(originalUpdate.channelId);
    }
    const chatId = deletedEvent.chatId;
    if (chatId === undefined || chatId === null) {
        return null;
    }
    return chatId.toString();
}
function normalizeDeletedChannelId(value) {
    if (typeof value === 'number' || typeof value === 'bigint') {
        const id = String(value);
        if (id.startsWith('-100'))
            return id;
        if (id.startsWith('-'))
            return id;
        return `-100${id}`;
    }
    if (typeof value === 'string') {
        const id = value.trim();
        if (!id)
            return null;
        if (id.startsWith('-100'))
            return id;
        if (id.startsWith('-'))
            return id;
        if (/^\d+$/.test(id))
            return `-100${id}`;
        return id;
    }
    if (typeof value === 'object' && value !== null && 'toString' in value) {
        return normalizeDeletedChannelId(value.toString());
    }
    return null;
}
function expandNumericIdAliases(value) {
    const trimmed = value.trim();
    if (!trimmed) {
        return [];
    }
    const aliases = new Set([trimmed]);
    if (!/^-?\d+$/.test(trimmed)) {
        return Array.from(aliases);
    }
    if (trimmed.startsWith('-100') && trimmed.length > 4) {
        const bare = trimmed.slice(4);
        aliases.add(bare);
        aliases.add(`-${bare}`);
        return Array.from(aliases);
    }
    if (trimmed.startsWith('-')) {
        const bare = trimmed.slice(1);
        aliases.add(bare);
        aliases.add(`-100${bare}`);
        return Array.from(aliases);
    }
    aliases.add(`-${trimmed}`);
    aliases.add(`-100${trimmed}`);
    return Array.from(aliases);
}
//# sourceMappingURL=TelegramGramProTrigger.node.js.map