"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatRouter = chatRouter;
const clientManager_1 = require("../core/clientManager");
const floodWaitHandler_1 = require("../core/floodWaitHandler");
const teleproto_1 = require("teleproto");
const big_integer_1 = __importDefault(require("big-integer"));
const cache_1 = require("../core/cache");
const message_operations_1 = require("./message.operations");
function getEntityTitle(entity) {
    var _a;
    if (entity instanceof teleproto_1.Api.Chat || entity instanceof teleproto_1.Api.Channel) {
        return (_a = entity.title) !== null && _a !== void 0 ? _a : '';
    }
    if (entity instanceof teleproto_1.Api.User) {
        return [entity.firstName, entity.lastName].filter(Boolean).join(' ') || entity.username || '';
    }
    return '';
}
function getEntityUsername(entity) {
    var _a;
    if (entity instanceof teleproto_1.Api.User || entity instanceof teleproto_1.Api.Channel) {
        return (_a = entity.username) !== null && _a !== void 0 ? _a : null;
    }
    return null;
}
function getEntityId(entity) {
    if (entity instanceof teleproto_1.Api.User ||
        entity instanceof teleproto_1.Api.UserEmpty ||
        entity instanceof teleproto_1.Api.Chat ||
        entity instanceof teleproto_1.Api.ChatEmpty ||
        entity instanceof teleproto_1.Api.ChatForbidden ||
        entity instanceof teleproto_1.Api.Channel ||
        entity instanceof teleproto_1.Api.ChannelForbidden) {
        return entity.id.toString();
    }
    return '';
}
function getEntityAudience(entity) {
    var _a, _b;
    if (entity instanceof teleproto_1.Api.Chat) {
        return (_a = entity.participantsCount) !== null && _a !== void 0 ? _a : null;
    }
    if (entity instanceof teleproto_1.Api.Channel) {
        return (_b = entity.participantsCount) !== null && _b !== void 0 ? _b : null;
    }
    return null;
}
function getEntityCreateDate(entity) {
    if ((entity instanceof teleproto_1.Api.Chat || entity instanceof teleproto_1.Api.Channel) &&
        typeof entity.date === 'number') {
        return formatDate(new Date(entity.date * 1000));
    }
    return null;
}
function getDialogAccountType(entity) {
    if (entity instanceof teleproto_1.Api.User) {
        return entity.bot ? 'bot' : 'user';
    }
    if (entity instanceof teleproto_1.Api.Channel) {
        if (entity.broadcast) {
            return 'channel';
        }
        if (entity.megagroup) {
            return 'group';
        }
    }
    if (entity instanceof teleproto_1.Api.Chat) {
        return 'group';
    }
    return 'user';
}
function isSupportedDialogFilter(filter) {
    return filter instanceof teleproto_1.Api.DialogFilter || filter instanceof teleproto_1.Api.DialogFilterChatlist;
}
function getDialogFilterTitle(filter) {
    if (filter.title instanceof teleproto_1.Api.TextWithEntities) {
        return filter.title.text;
    }
    return `Folder ${filter.id}`;
}
function matchPeer(peer, chatId) {
    var _a, _b;
    const candidate = peer;
    const peerId = (_b = (_a = candidate.userId) !== null && _a !== void 0 ? _a : candidate.chatId) !== null && _b !== void 0 ? _b : candidate.channelId;
    return (peerId === null || peerId === void 0 ? void 0 : peerId.toString()) === chatId;
}
function getCreatedChat(result) {
    const chats = result instanceof teleproto_1.Api.Updates || result instanceof teleproto_1.Api.UpdatesCombined ? result.chats : [];
    const chat = chats.find((candidate) => candidate instanceof teleproto_1.Api.Chat || candidate instanceof teleproto_1.Api.Channel);
    if (!chat) {
        throw new Error('Telegram did not return the created chat or channel.');
    }
    return chat;
}
function getInviteLink(invite) {
    return invite instanceof teleproto_1.Api.ChatInviteExported ? invite.link : null;
}
async function chatRouter(operation, i) {
    const creds = (await this.getCredentials('telegramGramProApi'));
    const client = await (0, clientManager_1.getClient)(creds.apiId, creds.apiHash, creds.session);
    switch (operation) {
        case 'getDialogs':
            return getDialogs.call(this, client, i);
        case 'getChat':
            return getChat.call(this, client, i);
        case 'joinChat':
            return joinChat.call(this, client, i);
        case 'leaveChat':
            return leaveChat.call(this, client, i);
        case 'createChat':
            return createChat.call(this, client, i);
        case 'createChannel':
            return createChannel.call(this, client, i);
        case 'chatAction':
            return chatAction.call(this, client, i);
        default:
            throw new Error(`Chat operation not supported: ${operation}`);
    }
}
async function getChat(client, i) {
    const chatId = this.getNodeParameter('chatId', i);
    const cacheKey = cache_1.CacheKeys.getChat(chatId);
    const cachedChat = cache_1.cache.get(cacheKey);
    if (cachedChat) {
        return [
            {
                json: cachedChat,
                pairedItem: { item: i },
            },
        ];
    }
    const chat = await client.getEntity(chatId);
    const json = {
        id: getEntityId(chat),
        title: getEntityTitle(chat),
        username: getEntityUsername(chat),
    };
    cache_1.cache.set(cacheKey, json);
    return [
        {
            json,
            pairedItem: { item: i },
        },
    ];
}
async function getDialogs(client, i) {
    var _a, _b, _c, _d, _e;
    const rawLimit = this.getNodeParameter('limit', i, null);
    const targetLimit = typeof rawLimit === 'number' && !isNaN(rawLimit) && rawLimit > 0 ? rawLimit : Infinity;
    const groupByFolders = this.getNodeParameter('groupByFolders', i, false);
    const useCache = targetLimit !== Infinity && targetLimit <= 500 && !groupByFolders;
    const cacheKey = cache_1.CacheKeys.getDialogs(targetLimit === Infinity ? -1 : targetLimit);
    if (useCache) {
        const cachedDialogs = cache_1.cache.get(cacheKey);
        if (cachedDialogs) {
            return cachedDialogs.map((d) => ({
                json: d,
                pairedItem: { item: i },
            }));
        }
    }
    let filters = [];
    if (groupByFolders) {
        try {
            const res = await client.invoke(new teleproto_1.Api.messages.GetDialogFilters());
            filters =
                res instanceof teleproto_1.Api.messages.DialogFilters
                    ? res.filters.filter(isSupportedDialogFilter)
                    : [];
        }
        catch {
            filters = [];
        }
    }
    const items = [];
    const allChats = [];
    let count = 0;
    const dialogs = (await client.getDialogs({
        limit: targetLimit === Infinity ? undefined : targetLimit,
    }));
    for (const dialog of dialogs) {
        if (targetLimit !== Infinity && count >= targetLimit)
            break;
        const entity = dialog.entity;
        const id = entity ? getEntityId(entity) : ((_b = (_a = dialog.id) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : '');
        const title = entity ? getEntityTitle(entity) : ((_d = (_c = dialog.title) !== null && _c !== void 0 ? _c : dialog.name) !== null && _d !== void 0 ? _d : '');
        const username = entity ? getEntityUsername(entity) : null;
        const accountType = entity ? getDialogAccountType(entity) : 'user';
        const visibility = username ? 'Public' : 'Private';
        const audience = entity ? getEntityAudience(entity) : null;
        const createDate = entity ? getEntityCreateDate(entity) : null;
        const joinedDate = null;
        const chatJson = {
            id,
            title,
            username,
            account_type: accountType,
            type: visibility,
            audience,
            joinedDate,
            createDate,
            unread: (_e = dialog.unreadCount) !== null && _e !== void 0 ? _e : 0,
        };
        if (groupByFolders) {
            allChats.push(chatJson);
        }
        else {
            items.push({
                json: chatJson,
                pairedItem: { item: i },
            });
        }
        count++;
    }
    if (groupByFolders) {
        const groupedResults = [];
        const assignedChatIds = new Set();
        for (const filter of filters) {
            const folderName = getDialogFilterTitle(filter);
            const includePeers = filter.includePeers;
            const excludePeers = filter instanceof teleproto_1.Api.DialogFilter ? filter.excludePeers : [];
            const safeKey = folderName
                .replace(/[^a-z0-9]/gi, '_')
                .replace(/_+/g, '_')
                .replace(/^_+|_+$/g, '') || `folder_${filter.id}`;
            const folderChats = [];
            for (const chat of allChats) {
                let included = false;
                const chatIdStr = chat.id;
                if (includePeers.length > 0) {
                    for (const peer of includePeers) {
                        if (matchPeer(peer, chatIdStr)) {
                            included = true;
                            break;
                        }
                    }
                }
                if (!included && filter instanceof teleproto_1.Api.DialogFilter) {
                    const accType = chat.account_type;
                    if (filter.contacts && accType === 'user')
                        included = true;
                    if (filter.nonContacts && accType === 'user')
                        included = true;
                    if (filter.groups && accType === 'group')
                        included = true;
                    if (filter.broadcasts && accType === 'channel')
                        included = true;
                    if (filter.bots && accType === 'bot')
                        included = true;
                }
                if (included && excludePeers.length > 0) {
                    for (const peer of excludePeers) {
                        if (matchPeer(peer, chatIdStr)) {
                            included = false;
                            break;
                        }
                    }
                }
                if (included) {
                    folderChats.push(chat);
                    assignedChatIds.add(chatIdStr);
                }
            }
            if (folderChats.length > 0) {
                groupedResults.push({
                    json: {
                        [safeKey]: folderChats,
                        folder_name: folderName,
                    },
                    pairedItem: { item: i },
                });
            }
        }
        const otherChats = allChats.filter((chat) => !assignedChatIds.has(chat.id));
        if (otherChats.length > 0) {
            groupedResults.push({
                json: {
                    Other: otherChats,
                    folder_name: 'Other',
                },
                pairedItem: { item: i },
            });
        }
        if (groupedResults.length === 0) {
            return allChats.map((chat) => ({ json: chat, pairedItem: { item: i } }));
        }
        return groupedResults;
    }
    if (useCache) {
        cache_1.cache.set(cacheKey, items.map(({ json }) => json));
    }
    return items;
}
function formatDate(date) {
    const istString = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    }).format(date);
    const parts = istString.split(',').map((s) => s.trim());
    const datePartRaw = parts[0] || '';
    const timePartRaw = parts[1] || '';
    const datePieces = datePartRaw.split(' ');
    const day = datePieces[0] || '';
    const month = datePieces[1] || '';
    const year = datePieces[2] || '';
    const timePieces = timePartRaw.split(' ');
    const time = timePieces[0] || '';
    const ampm = (timePieces[1] || '').toUpperCase();
    const datePart = `${day}-${month}-${year}`;
    return `${datePart} (${time} ${ampm})`;
}
function normalizeIdForGroup(rawId) {
    let idStr = rawId.trim();
    if (idStr.startsWith('-100'))
        idStr = idStr.substring(4);
    else if (idStr.startsWith('-'))
        idStr = idStr.substring(1);
    return idStr;
}
async function joinChat(client, i) {
    const chatId = this.getNodeParameter('chatId', i);
    const result = await (0, floodWaitHandler_1.safeExecute)(async () => {
        var _a;
        if (chatId.includes('t.me/+') || chatId.includes('joinchat/')) {
            const hash = (_a = chatId.split('/').pop()) === null || _a === void 0 ? void 0 : _a.replace('+', '');
            return await client.invoke(new teleproto_1.Api.messages.ImportChatInvite({ hash }));
        }
        try {
            const numericId = normalizeIdForGroup(chatId);
            return await client.invoke(new teleproto_1.Api.messages.AddChatUser({
                chatId: (0, big_integer_1.default)(numericId),
                userId: 'me',
                fwdLimit: 0,
            }));
        }
        catch {
            return await client.invoke(new teleproto_1.Api.channels.JoinChannel({ channel: chatId }));
        }
    });
    return [
        {
            json: { success: true, result: result },
            pairedItem: { item: i },
        },
    ];
}
async function leaveChat(client, i) {
    const chatId = this.getNodeParameter('chatId', i);
    const result = await (0, floodWaitHandler_1.safeExecute)(async () => {
        try {
            return await client.invoke(new teleproto_1.Api.channels.LeaveChannel({ channel: chatId }));
        }
        catch {
            const numericId = normalizeIdForGroup(chatId);
            return await client.invoke(new teleproto_1.Api.messages.DeleteChatUser({
                chatId: (0, big_integer_1.default)(numericId),
                userId: 'me',
            }));
        }
    });
    return [
        {
            json: { success: true, result: result },
            pairedItem: { item: i },
        },
    ];
}
async function createChat(client, i) {
    const title = this.getNodeParameter('chatTitle', i);
    const about = this.getNodeParameter('chatAbout', i);
    const result = (await (0, floodWaitHandler_1.safeExecute)(() => client.invoke(new teleproto_1.Api.channels.CreateChannel({
        title: title,
        about: about,
        megagroup: true,
        broadcast: false,
    }))));
    const chat = getCreatedChat(result);
    let inviteLink = null;
    try {
        const peer = await client.getEntity(chat.id);
        const invite = await client.invoke(new teleproto_1.Api.messages.ExportChatInvite({ peer }));
        inviteLink = getInviteLink(invite);
    }
    catch {
    }
    const createdAt = chat.date ? new Date(chat.date * 1000) : null;
    const formattedDate = createdAt ? formatDateWithTime(createdAt) : null;
    const isPublic = chat instanceof teleproto_1.Api.Channel ? !!chat.username : false;
    return [
        {
            json: {
                success: true,
                message: 'Group created successfully',
                chatId: chat.id.toString(),
                title: chat.title,
                bio: about || null,
                groupType: isPublic ? 'Public' : 'Private',
                createTime: formattedDate,
                inviteLink: inviteLink,
            },
            pairedItem: { item: i },
        },
    ];
}
async function createChannel(client, i) {
    const title = this.getNodeParameter('chatTitle', i);
    const about = this.getNodeParameter('chatAbout', i);
    const result = (await (0, floodWaitHandler_1.safeExecute)(() => client.invoke(new teleproto_1.Api.channels.CreateChannel({
        title: title,
        about: about,
        megagroup: false,
        broadcast: true,
    }))));
    const chat = getCreatedChat(result);
    let inviteLink = null;
    try {
        const peer = await client.getEntity(chat.id);
        const invite = await client.invoke(new teleproto_1.Api.messages.ExportChatInvite({ peer }));
        inviteLink = getInviteLink(invite);
    }
    catch {
    }
    const createdAt = chat.date ? new Date(chat.date * 1000) : null;
    const formattedDate = createdAt ? formatDateWithTime(createdAt) : null;
    const isPublic = chat instanceof teleproto_1.Api.Channel ? !!chat.username : false;
    return [
        {
            json: {
                success: true,
                message: 'Channel created successfully',
                chatId: chat.id.toString(),
                title: chat.title,
                bio: about || null,
                channelType: isPublic ? 'Public' : 'Private',
                createTime: formattedDate,
                inviteLink: inviteLink,
            },
            pairedItem: { item: i },
        },
    ];
}
async function chatAction(client, i) {
    const chatId = this.getNodeParameter('chatId', i);
    const actionType = this.getNodeParameter('actionType', i);
    const peer = await (0, message_operations_1.resolvePeer)(client, chatId);
    function buildAction() {
        switch (actionType) {
            case 'chatActionTyping':
                return new teleproto_1.Api.SendMessageTypingAction();
            case 'chatActionRecordingVideo':
                return new teleproto_1.Api.SendMessageRecordVideoAction();
            case 'chatActionUploadingVideo':
                return new teleproto_1.Api.SendMessageUploadVideoAction({ progress: 0 });
            case 'chatActionRecordingVoiceNote':
                return new teleproto_1.Api.SendMessageRecordAudioAction();
            case 'chatActionUploadingVoiceNote':
                return new teleproto_1.Api.SendMessageUploadAudioAction({ progress: 0 });
            case 'chatActionUploadingPhoto':
                return new teleproto_1.Api.SendMessageUploadPhotoAction({ progress: 0 });
            case 'chatActionUploadingDocument':
                return new teleproto_1.Api.SendMessageUploadDocumentAction({ progress: 0 });
            case 'chatActionChoosingSticker':
                return new teleproto_1.Api.SendMessageChooseStickerAction();
            case 'chatActionChoosingLocation':
                return new teleproto_1.Api.SendMessageGeoLocationAction();
            case 'chatActionChoosingContact':
                return new teleproto_1.Api.SendMessageChooseContactAction();
            case 'chatActionStartPlayingGame':
                return new teleproto_1.Api.SendMessageGamePlayAction();
            case 'chatActionRecordingVideoNote':
                return new teleproto_1.Api.SendMessageRecordRoundAction();
            case 'chatActionUploadingVideoNote':
                return new teleproto_1.Api.SendMessageUploadRoundAction({ progress: 0 });
            case 'chatActionWatchingAnimations':
                return new teleproto_1.Api.SendMessageEmojiInteractionSeen({ emoticon: '👀' });
            case 'chatActionCancel':
                return new teleproto_1.Api.SendMessageCancelAction();
            default:
                return new teleproto_1.Api.SendMessageTypingAction();
        }
    }
    await (0, floodWaitHandler_1.safeExecute)(() => client.invoke(new teleproto_1.Api.messages.SetTyping({
        peer: peer,
        action: buildAction(),
    })));
    return [
        {
            json: {
                success: true,
                peer,
                actionType,
                message: `Chat action "${actionType}" sent successfully`,
            },
            pairedItem: { item: i },
        },
    ];
}
function pad(num) {
    return num < 10 ? `0${num}` : `${num}`;
}
function formatDateWithTime(date) {
    const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
    const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
    ];
    const day = pad(ist.getDate());
    const month = months[ist.getMonth()];
    const year = ist.getFullYear();
    let hours = ist.getHours();
    const minutes = pad(ist.getMinutes());
    const seconds = pad(ist.getSeconds());
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hourStr = pad(hours);
    const datePart = `${day}-${month}-${year}`;
    const timePart = `${hourStr}:${minutes}:${seconds} ${ampm}`;
    return `${datePart} (${timePart})`;
}
//# sourceMappingURL=chat.operations.js.map