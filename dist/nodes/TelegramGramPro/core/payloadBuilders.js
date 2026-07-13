"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTriggerPayload = buildTriggerPayload;
exports.buildAlbumTriggerPayload = buildAlbumTriggerPayload;
exports.buildSharedMessagePayload = buildSharedMessagePayload;
exports.buildSharedAlbumPayload = buildSharedAlbumPayload;
exports.buildUserUpdatePayload = buildUserUpdatePayload;
exports.resolveMessageContext = resolveMessageContext;
exports.resolveMessageContextFromEntities = resolveMessageContextFromEntities;
exports.createSharedBinaryExecutionItem = createSharedBinaryExecutionItem;
exports.detectMessageType = detectMessageType;
exports.detectWebPreview = detectWebPreview;
exports.downloadBinaryData = downloadBinaryData;
exports.toIsoDate = toIsoDate;
const teleproto_1 = require("teleproto");
const messageFormatting_1 = require("./messageFormatting");
const fileSizeUtils_1 = require("./fileSizeUtils");
function buildTriggerPayload(updateType, message, messageContext) {
    const mediaFiles = collectMediaPayloadEntries([message]);
    const primaryMedia = mediaFiles[0];
    const fileSizeBytes = primaryMedia === null || primaryMedia === void 0 ? void 0 : primaryMedia.bytes;
    const fileSizeHuman = primaryMedia === null || primaryMedia === void 0 ? void 0 : primaryMedia.size;
    const hasMedia = mediaFiles.length > 0;
    const messageType = detectMessageType(message);
    const rawMessage = getMessageText(message);
    const hasWebPreview = detectWebPreview(message);
    return {
        updateType,
        groupedId: normalizeGroupedId(message.groupedId),
        mediaCount: mediaFiles.length,
        message: getRichMessageText(message),
        rawMessage,
        date: toIsoDate(message.date),
        editDate: toIsoDate(message.editDate),
        chatName: messageContext.chatName,
        chatId: messageContext.chatId,
        chatType: messageContext.chatType,
        senderName: messageContext.senderName,
        senderId: messageContext.senderId,
        senderIsBot: messageContext.senderIsBot,
        messageId: String(message.id),
        isPrivate: messageContext.isPrivateChat,
        isGroup: messageContext.isGroupChat,
        isChannel: messageContext.isChannelChat,
        isOutgoing: Boolean(message.out),
        messageType,
        hasMedia,
        fileName: primaryMedia === null || primaryMedia === void 0 ? void 0 : primaryMedia.fileName,
        fileExtension: primaryMedia === null || primaryMedia === void 0 ? void 0 : primaryMedia.fileExtension,
        mimeType: primaryMedia === null || primaryMedia === void 0 ? void 0 : primaryMedia.mimeType,
        size: fileSizeHuman,
        bytes: fileSizeBytes,
        mediaFiles,
        hasWebPreview,
    };
}
function buildAlbumTriggerPayload(updateType, messages, messageContext) {
    var _a, _b;
    const primaryMessage = (_a = messages.find((message) => { var _a, _b; return ((_b = (_a = message.message) !== null && _a !== void 0 ? _a : message.text) !== null && _b !== void 0 ? _b : '').trim(); })) !== null && _a !== void 0 ? _a : messages[0];
    const mediaFiles = collectMediaPayloadEntries(messages);
    const primaryMedia = mediaFiles[0];
    return {
        updateType,
        groupedId: normalizeGroupedId(primaryMessage.groupedId),
        mediaCount: mediaFiles.length,
        message: getRichMessageText(primaryMessage),
        rawMessage: getMessageText(primaryMessage),
        date: toIsoDate(primaryMessage.date),
        editDate: toIsoDate(primaryMessage.editDate),
        chatName: messageContext.chatName,
        chatId: messageContext.chatId,
        chatType: messageContext.chatType,
        senderName: messageContext.senderName,
        senderId: messageContext.senderId,
        senderIsBot: messageContext.senderIsBot,
        messageId: String(primaryMessage.id),
        isPrivate: messageContext.isPrivateChat,
        isGroup: messageContext.isGroupChat,
        isChannel: messageContext.isChannelChat,
        isOutgoing: Boolean(primaryMessage.out),
        messageType: (_b = primaryMedia === null || primaryMedia === void 0 ? void 0 : primaryMedia.messageType) !== null && _b !== void 0 ? _b : detectMessageType(primaryMessage),
        hasMedia: mediaFiles.length > 0,
        fileName: primaryMedia === null || primaryMedia === void 0 ? void 0 : primaryMedia.fileName,
        fileExtension: primaryMedia === null || primaryMedia === void 0 ? void 0 : primaryMedia.fileExtension,
        mimeType: primaryMedia === null || primaryMedia === void 0 ? void 0 : primaryMedia.mimeType,
        size: primaryMedia === null || primaryMedia === void 0 ? void 0 : primaryMedia.size,
        bytes: primaryMedia === null || primaryMedia === void 0 ? void 0 : primaryMedia.bytes,
        mediaFiles,
        hasWebPreview: messages.some((message) => detectWebPreview(message)),
    };
}
function buildSharedMessagePayload(message, messageContext) {
    return buildTriggerPayload(undefined, message, messageContext);
}
function buildSharedAlbumPayload(messages, messageContext) {
    return buildAlbumTriggerPayload(undefined, messages, messageContext);
}
async function buildUserUpdatePayload(event) {
    var _a, _b, _c, _d, _e, _f;
    const user = await event.getUser().catch(() => undefined);
    const statusClassName = getTelegramClassName(event.status);
    const actionClassName = getTelegramClassName(event.action);
    const userId = normalizeString(event.userId);
    const chatId = getUserUpdateChatId(event.originalUpdate);
    const chatType = detectUserUpdateChatType(event.originalUpdate);
    const chatName = user ? getEntityLabel(user) : chatId;
    const senderName = user ? getEntityLabel(user) : userId;
    const statusExpires = event.status instanceof teleproto_1.Api.UserStatusOnline ? toUnixNumber(event.status.expires) : undefined;
    const statusWasOnline = event.status instanceof teleproto_1.Api.UserStatusOffline
        ? toUnixNumber(event.status.wasOnline)
        : undefined;
    const statusByMe = event.status instanceof teleproto_1.Api.UserStatusRecently ||
        event.status instanceof teleproto_1.Api.UserStatusLastWeek ||
        event.status instanceof teleproto_1.Api.UserStatusLastMonth
        ? ((_a = event.status.byMe) !== null && _a !== void 0 ? _a : undefined)
        : undefined;
    const payload = {
        updateType: 'user_update',
        date: toIsoDate(new Date()),
        chatName,
        chatId,
        chatType,
        senderName,
        senderId: userId,
        senderIsBot: user instanceof teleproto_1.Api.User ? Boolean(user.bot) : null,
        isPrivate: chatType === 'user' || chatType === 'bot',
        isGroup: chatType === 'group' || chatType === 'supergroup',
        isChannel: chatType === 'channel',
        messageType: 'other',
        hasMedia: false,
        raw: {
            eventName: event._eventName,
            originalUpdateType: getTelegramClassName(event.originalUpdate),
        },
    };
    payload.userId = userId !== null && userId !== void 0 ? userId : undefined;
    payload.user = {
        id: userId,
        username: user instanceof teleproto_1.Api.User ? ((_b = user.username) !== null && _b !== void 0 ? _b : null) : null,
        firstName: user instanceof teleproto_1.Api.User ? ((_c = user.firstName) !== null && _c !== void 0 ? _c : null) : null,
        lastName: user instanceof teleproto_1.Api.User ? ((_d = user.lastName) !== null && _d !== void 0 ? _d : null) : null,
        phone: user instanceof teleproto_1.Api.User ? ((_e = user.phone) !== null && _e !== void 0 ? _e : null) : null,
        isBot: user instanceof teleproto_1.Api.User ? Boolean(user.bot) : null,
        isVerified: user instanceof teleproto_1.Api.User ? Boolean(user.verified) : null,
        isScam: user instanceof teleproto_1.Api.User ? Boolean(user.scam) : null,
        isFake: user instanceof teleproto_1.Api.User ? Boolean(user.fake) : null,
        isPremium: user instanceof teleproto_1.Api.User ? Boolean(user.premium) : null,
        isSupport: user instanceof teleproto_1.Api.User ? Boolean(user.support) : null,
        isMutualContact: user instanceof teleproto_1.Api.User ? Boolean(user.mutualContact) : null,
        isContact: user instanceof teleproto_1.Api.User ? Boolean(user.contact) : null,
        isDeleted: user instanceof teleproto_1.Api.User ? Boolean(user.deleted) : null,
        langCode: user instanceof teleproto_1.Api.User ? ((_f = user.langCode) !== null && _f !== void 0 ? _f : null) : null,
    };
    payload.status = {
        className: statusClassName,
        online: event.online,
        offline: event.offline,
        recently: event.recently,
        withinWeeks: event.withinWeeks,
        withinMonths: event.withinMonths,
        expires: statusExpires,
        expiresAt: event.until ? event.until.toISOString() : null,
        wasOnline: statusWasOnline,
        lastSeenAt: event.lastSeen ? event.lastSeen.toISOString() : null,
        byMe: statusByMe,
    };
    payload.action = {
        className: actionClassName,
        typing: event.typing,
        cancel: event.cancel,
        recording: event.recording,
        uploading: event.uploading,
        audio: event.audio,
        video: event.video,
        round: event.round,
        photo: event.photo,
        document: event.document,
        geo: event.geo,
        contact: event.contact,
        playing: event.playing,
        sticker: event.sticker,
        uploadProgress: event.uploadProgress,
    };
    return payload;
}
async function resolveMessageContext(message) {
    var _a, _b;
    const [chatResult, senderResult] = await Promise.allSettled([
        (_a = message.getChat) === null || _a === void 0 ? void 0 : _a.call(message),
        (_b = message.getSender) === null || _b === void 0 ? void 0 : _b.call(message),
    ]);
    const chatEntity = chatResult.status === 'fulfilled' ? chatResult.value : undefined;
    const senderEntity = senderResult.status === 'fulfilled' ? senderResult.value : undefined;
    return resolveMessageContextFromEntities(message, chatEntity, senderEntity);
}
function resolveMessageContextFromEntities(message, chatEntity, senderEntity) {
    var _a, _b;
    const chatType = detectChatType(message, chatEntity, senderEntity);
    return {
        chatName: (_a = getEntityLabel(chatEntity)) !== null && _a !== void 0 ? _a : fallbackChatName(message),
        chatUsername: getEntityUsername(chatEntity),
        chatId: normalizeString(message.chatId),
        chatType,
        isPrivateChat: isPrivateChatType(chatType),
        isGroupChat: isGroupChatType(chatType),
        isChannelChat: isChannelChatType(chatType),
        senderName: (_b = getEntityLabel(senderEntity)) !== null && _b !== void 0 ? _b : fallbackSenderName(message, chatEntity),
        senderUsername: getEntityUsername(senderEntity),
        senderId: normalizeString(message.senderId),
        senderIsBot: senderEntity instanceof teleproto_1.Api.User ? Boolean(senderEntity.bot) : null,
    };
}
async function createSharedBinaryExecutionItem(context, messages, payload, disableBinary) {
    var _a, _b;
    const item = {
        json: {
            ...payload,
            disableBinary,
        },
    };
    const mediaMessages = messages.filter((message) => shouldAttachBinary(detectMessageType(message)));
    if (mediaMessages.length === 0 || disableBinary) {
        return item;
    }
    const mediaFiles = Array.isArray(item.json.mediaFiles)
        ? [...item.json.mediaFiles]
        : [];
    const mediaFileIndexByMessageId = new Map();
    for (let index = 0; index < mediaFiles.length; index++) {
        const messageId = mediaFiles[index].messageId;
        if (messageId) {
            mediaFileIndexByMessageId.set(messageId, index);
        }
    }
    try {
        item.binary = {};
        for (let index = 0; index < mediaMessages.length; index++) {
            const currentMessage = mediaMessages[index];
            const currentMessageType = detectMessageType(currentMessage);
            const downloadedMedia = await downloadBinaryData(context, currentMessage, currentMessageType);
            if (!downloadedMedia) {
                continue;
            }
            const binaryProperty = index === 0 ? 'data' : `data_${index + 1}`;
            item.binary[binaryProperty] = downloadedMedia.binaryData;
            const targetIndex = (_a = mediaFileIndexByMessageId.get(String(currentMessage.id))) !== null && _a !== void 0 ? _a : index;
            const currentMediaFile = (_b = mediaFiles[targetIndex]) !== null && _b !== void 0 ? _b : {
                messageId: String(currentMessage.id),
                messageType: currentMessageType,
            };
            mediaFiles[targetIndex] = {
                ...currentMediaFile,
                binaryProperty,
                fileName: downloadedMedia.fileName,
                fileExtension: getFileExtension(downloadedMedia.fileName),
                mimeType: downloadedMedia.mimeType,
                binaryBase64: downloadedMedia.buffer.toString('base64'),
            };
        }
        if (mediaFiles.length > 0) {
            item.json.mediaFiles = mediaFiles;
            const firstMedia = mediaFiles[0];
            item.json.fileName = firstMedia.fileName;
            item.json.fileExtension = firstMedia.fileExtension;
            item.json.mimeType = firstMedia.mimeType;
        }
        if (Object.keys(item.binary).length === 0) {
            delete item.binary;
        }
    }
    catch (error) {
        item.json.mediaDownloadError = getErrorMessage(error);
    }
    return item;
}
function collectMediaPayloadEntries(messages) {
    return messages
        .map((message) => createMediaPayloadEntry(message))
        .filter((entry) => entry !== null);
}
function createMediaPayloadEntry(message) {
    const messageType = detectMessageType(message);
    if (!shouldAttachBinary(messageType)) {
        return null;
    }
    const fileSizeBytes = extractMediaFileSize(message);
    const mediaMetadata = extractMediaMetadata(message, messageType);
    return {
        messageId: String(message.id),
        groupedId: normalizeGroupedId(message.groupedId),
        messageType,
        fileName: mediaMetadata.fileName,
        fileExtension: mediaMetadata.fileExtension,
        mimeType: mediaMetadata.mimeType,
        size: fileSizeBytes ? (0, fileSizeUtils_1.formatBytesToHuman)(fileSizeBytes) : undefined,
        bytes: fileSizeBytes,
    };
}
function detectMessageType(message) {
    var _a;
    if (message.photo) {
        return 'photo';
    }
    if (message.video) {
        return 'video';
    }
    if (message.document) {
        return 'document';
    }
    if (message.media && typeof message.media === 'object' && 'document' in message.media) {
        const doc = message.media.document;
        if (doc)
            return 'document';
    }
    if (((_a = message.message) !== null && _a !== void 0 ? _a : '').trim()) {
        return 'text';
    }
    return 'other';
}
function detectWebPreview(message) {
    if (!message.media) {
        return false;
    }
    if (message.media instanceof teleproto_1.Api.MessageMediaWebPage) {
        return !(message.media.webpage instanceof teleproto_1.Api.WebPageEmpty);
    }
    if ('webpage' in message.media) {
        return !!message.media.webpage && !(message.media.webpage instanceof teleproto_1.Api.WebPageEmpty);
    }
    return false;
}
function shouldAttachBinary(messageType) {
    return messageType === 'photo' || messageType === 'video' || messageType === 'document';
}
async function downloadBinaryData(context, message, messageType) {
    var _a, _b;
    const downloadResult = await message.downloadMedia({});
    const buffer = await toBuffer(downloadResult);
    if (!buffer) {
        return null;
    }
    const document = message.document;
    const mimeType = messageType === 'photo' ? 'image/jpeg' : ((_a = document === null || document === void 0 ? void 0 : document.mimeType) !== null && _a !== void 0 ? _a : 'application/octet-stream');
    const fileName = (_b = getDocumentFileName(document)) !== null && _b !== void 0 ? _b : inferFileName(messageType, message.id, mimeType);
    const binaryData = await context.helpers.prepareBinaryData(buffer, fileName, mimeType);
    return {
        binaryData,
        buffer,
        fileName,
        mimeType,
    };
}
async function toBuffer(value) {
    if (!value)
        return null;
    if (Buffer.isBuffer(value))
        return value;
    if (value instanceof Uint8Array)
        return Buffer.from(value);
    if (typeof value === 'string')
        return Buffer.from(value);
    if (typeof value === 'object' &&
        value !== null &&
        'on' in value &&
        typeof value.on === 'function') {
        return await new Promise((resolve, reject) => {
            const chunks = [];
            const stream = value;
            stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
            stream.on('error', (err) => reject(err));
        });
    }
    if (typeof value === 'object' &&
        value !== null &&
        'getReader' in value &&
        typeof value.getReader === 'function') {
        const reader = value.getReader();
        const chunks = [];
        while (true) {
            const { done, value: chunk } = await reader.read();
            if (done)
                break;
            if (chunk)
                chunks.push(chunk);
        }
        return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    }
    return null;
}
function getDocumentFileName(document) {
    if (!document)
        return null;
    for (const attribute of document.attributes) {
        if (attribute instanceof teleproto_1.Api.DocumentAttributeFilename) {
            return attribute.fileName;
        }
    }
    return null;
}
function extractMediaMetadata(message, messageType) {
    var _a, _b;
    if (!shouldAttachBinary(messageType))
        return {};
    const document = message.document;
    const mimeType = messageType === 'photo' ? 'image/jpeg' : ((_a = document === null || document === void 0 ? void 0 : document.mimeType) !== null && _a !== void 0 ? _a : 'application/octet-stream');
    const fileName = (_b = getDocumentFileName(document)) !== null && _b !== void 0 ? _b : inferFileName(messageType, message.id, mimeType);
    return {
        fileName,
        fileExtension: getFileExtension(fileName),
        mimeType,
    };
}
function inferFileName(messageType, messageId, mimeType) {
    if (messageType === 'photo')
        return `photo_${messageId}.jpg`;
    if (messageType === 'video')
        return `video_${messageId}${getExtensionFromMimeType(mimeType) || '.mp4'}`;
    return `document_${messageId}${getExtensionFromMimeType(mimeType)}`;
}
function getFileExtension(fileName) {
    if (!fileName)
        return undefined;
    const match = /\.([^.]+)$/.exec(fileName);
    return match ? `.${match[1]}` : undefined;
}
function getExtensionFromMimeType(mimeType) {
    var _a;
    const knownExtensions = {
        'application/pdf': '.pdf',
        'application/zip': '.zip',
        'image/gif': '.gif',
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'text/plain': '.txt',
        'video/mp4': '.mp4',
        'video/quicktime': '.mov',
    };
    return (_a = knownExtensions[mimeType]) !== null && _a !== void 0 ? _a : '';
}
function extractMediaFileSize(message) {
    const extractSize = (obj) => {
        if (!obj || typeof obj !== 'object')
            return undefined;
        if (Array.isArray(obj)) {
            let max = 0;
            for (const item of obj) {
                const size = extractSize(item);
                if (size !== undefined && size > max)
                    max = size;
                if (typeof item === 'number' && item > max)
                    max = item;
            }
            return max > 0 ? max : undefined;
        }
        const record = obj;
        if ('sizes' in record)
            return extractSize(record.sizes);
        if ('size' in record) {
            const val = record.size;
            if (typeof val === 'number')
                return val;
            if (typeof val === 'bigint')
                return Number(val);
            if (typeof val === 'object' && val !== null && 'toString' in val) {
                const str = val.toString();
                if (/^\d+$/.test(str))
                    return Number(str);
            }
        }
        return undefined;
    };
    const msgRec = message;
    const candidates = [
        msgRec.document,
        msgRec.video,
        msgRec.audio,
        msgRec.voice,
        msgRec.photo,
        message.media,
    ];
    for (const candidate of candidates) {
        const size = extractSize(candidate);
        if (size !== undefined && size > 0)
            return size;
    }
    return undefined;
}
function detectChatType(message, chatEntity, senderEntity) {
    if (chatEntity instanceof teleproto_1.Api.User)
        return chatEntity.bot ? 'bot' : 'user';
    if (chatEntity instanceof teleproto_1.Api.Chat || chatEntity instanceof teleproto_1.Api.ChatForbidden)
        return 'group';
    if (chatEntity instanceof teleproto_1.Api.Channel || chatEntity instanceof teleproto_1.Api.ChannelForbidden)
        return chatEntity.broadcast ? 'channel' : 'supergroup';
    if (message.peerId instanceof teleproto_1.Api.PeerUser)
        return senderEntity instanceof teleproto_1.Api.User && senderEntity.bot ? 'bot' : 'user';
    if (message.peerId instanceof teleproto_1.Api.PeerChat)
        return 'group';
    if (message.peerId instanceof teleproto_1.Api.PeerChannel)
        return message.post ? 'channel' : 'supergroup';
    return 'unknown';
}
function isPrivateChatType(chatType) {
    return chatType === 'user' || chatType === 'bot';
}
function isGroupChatType(chatType) {
    return chatType === 'group' || chatType === 'supergroup';
}
function isChannelChatType(chatType) {
    return chatType === 'channel';
}
function getEntityLabel(entity) {
    var _a;
    if (entity instanceof teleproto_1.Api.Channel ||
        entity instanceof teleproto_1.Api.ChannelForbidden ||
        entity instanceof teleproto_1.Api.Chat ||
        entity instanceof teleproto_1.Api.ChatForbidden)
        return (_a = entity.title) !== null && _a !== void 0 ? _a : null;
    if (entity instanceof teleproto_1.Api.User) {
        const fullName = [entity.firstName, entity.lastName].filter(Boolean).join(' ').trim();
        return fullName || entity.username || null;
    }
    return null;
}
function getEntityUsername(entity) {
    var _a;
    if (entity instanceof teleproto_1.Api.Channel || entity instanceof teleproto_1.Api.User)
        return (_a = entity.username) !== null && _a !== void 0 ? _a : null;
    return null;
}
function fallbackChatName(message) {
    if (message.isPrivate && message.senderId)
        return message.senderId.toString();
    return normalizeString(message.chatId);
}
function fallbackSenderName(message, chatEntity) {
    var _a;
    if (message.isChannel && !message.senderId)
        return (_a = getEntityLabel(chatEntity)) !== null && _a !== void 0 ? _a : normalizeString(message.chatId);
    return normalizeString(message.senderId);
}
function normalizeString(value) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint')
        return String(value);
    if (typeof value === 'object' && value !== null && 'toString' in value) {
        const s = value.toString();
        if (typeof s === 'string' && s !== '[object Object]')
            return s;
    }
    return null;
}
function normalizeGroupedId(value) {
    const s = normalizeString(value);
    return s !== null && s !== void 0 ? s : undefined;
}
function getTelegramClassName(value) {
    if (!value || typeof value !== 'object')
        return null;
    const maybeClassName = value.className;
    return typeof maybeClassName === 'string' ? maybeClassName : null;
}
function getUserUpdateChatId(originalUpdate) {
    if (originalUpdate instanceof teleproto_1.Api.UpdateChatUserTyping)
        return normalizeString(originalUpdate.chatId);
    if (originalUpdate instanceof teleproto_1.Api.UpdateChannelUserTyping)
        return normalizeString(originalUpdate.channelId);
    return normalizeString(originalUpdate instanceof teleproto_1.Api.UpdateUserStatus ? originalUpdate.userId : null);
}
function detectUserUpdateChatType(originalUpdate) {
    if (originalUpdate instanceof teleproto_1.Api.UpdateChatUserTyping)
        return 'group';
    if (originalUpdate instanceof teleproto_1.Api.UpdateChannelUserTyping)
        return 'channel';
    return 'user';
}
function toUnixNumber(value) {
    if (typeof value === 'number')
        return value;
    if (typeof value === 'bigint')
        return Number(value);
    if (typeof value === 'object' && value !== null && 'toString' in value) {
        const numericValue = Number(value.toString());
        return Number.isFinite(numericValue) ? numericValue : undefined;
    }
    return undefined;
}
function getMessageText(message) {
    var _a, _b;
    return (_b = (_a = message.message) !== null && _a !== void 0 ? _a : message.text) !== null && _b !== void 0 ? _b : '';
}
function getRichMessageText(message) {
    const t = getMessageText(message);
    const entities = Array.isArray(message.entities) ? message.entities : [];
    return (0, messageFormatting_1.renderTelegramEntities)(t, entities);
}
function toIsoDate(value) {
    if (value instanceof Date)
        return value.toISOString();
    if (typeof value === 'number')
        return new Date(value * 1000).toISOString();
    return null;
}
function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=payloadBuilders.js.map