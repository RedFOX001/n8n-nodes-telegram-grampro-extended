"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.channelRouter = channelRouter;
const clientManager_1 = require("../core/clientManager");
const floodWaitHandler_1 = require("../core/floodWaitHandler");
const rateLimiter_1 = require("../core/rateLimiter");
const teleproto_1 = require("teleproto");
const big_integer_1 = __importDefault(require("big-integer"));
const Logger_1 = require("teleproto/extensions/Logger");
function isChannelEntity(entity) {
    return entity instanceof teleproto_1.Api.Chat || entity instanceof teleproto_1.Api.Channel;
}
function indexUsersById(usersById, users) {
    for (const user of users) {
        if (user instanceof teleproto_1.Api.User) {
            usersById.set(user.id.toString(), user);
        }
    }
}
function getPeerUserId(peer) {
    var _a;
    if (peer instanceof teleproto_1.Api.PeerUser) {
        return peer.userId.toString();
    }
    const candidate = peer;
    return (_a = candidate.userId) === null || _a === void 0 ? void 0 : _a.toString();
}
function normalizeChatParticipant(participant) {
    if (participant instanceof teleproto_1.Api.ChatParticipantCreator) {
        return {
            userId: participant.userId.toString(),
            isAdmin: true,
            isCreator: true,
        };
    }
    if (participant instanceof teleproto_1.Api.ChatParticipantAdmin) {
        return {
            userId: participant.userId.toString(),
            isAdmin: true,
            isCreator: false,
        };
    }
    if (participant instanceof teleproto_1.Api.ChatParticipant) {
        return {
            userId: participant.userId.toString(),
            isAdmin: false,
            isCreator: false,
        };
    }
    return null;
}
function normalizeChannelParticipant(participant) {
    if (participant instanceof teleproto_1.Api.ChannelParticipantCreator) {
        return {
            userId: participant.userId.toString(),
            isAdmin: true,
            isCreator: true,
            adminRights: participant.adminRights,
        };
    }
    if (participant instanceof teleproto_1.Api.ChannelParticipantAdmin) {
        return {
            userId: participant.userId.toString(),
            isAdmin: true,
            isCreator: false,
            adminRights: participant.adminRights,
        };
    }
    if (participant instanceof teleproto_1.Api.ChannelParticipant ||
        participant instanceof teleproto_1.Api.ChannelParticipantSelf) {
        return {
            userId: participant.userId.toString(),
            isAdmin: false,
            isCreator: false,
        };
    }
    if (participant instanceof teleproto_1.Api.ChannelParticipantBanned ||
        participant instanceof teleproto_1.Api.ChannelParticipantLeft) {
        const userId = getPeerUserId(participant.peer);
        if (!userId) {
            return null;
        }
        return {
            userId,
            isAdmin: false,
            isCreator: false,
        };
    }
    return null;
}
function getEntityTypeName(entity) {
    if (!entity || typeof entity !== 'object') {
        return 'unknown';
    }
    const maybeClassName = entity.className;
    return typeof maybeClassName === 'string' ? maybeClassName : 'unknown';
}
async function channelRouter(operation, i) {
    const creds = (await this.getCredentials('telegramGramProApi'));
    const client = await (0, clientManager_1.getClient)(creds.apiId, creds.apiHash, creds.session);
    switch (operation) {
        case 'getMembers':
            return getChannelParticipants.call(this, client, i);
        case 'addMember':
            return addChannelMember.call(this, client, i);
        case 'removeMember':
            return removeChannelMember.call(this, client, i);
        case 'banUser':
            return banUser.call(this, client, i);
        case 'unbanUser':
            return unbanUser.call(this, client, i);
        case 'promoteUser':
            return promoteUser.call(this, client, i);
        default:
            throw new Error(`Channel operation not supported: ${operation}`);
    }
}
async function getChannelParticipants(client, i) {
    const channelId = this.getNodeParameter('channelId', i);
    const rawLimit = this.getNodeParameter('limit', i, null);
    const limit = typeof rawLimit === 'number' && !isNaN(rawLimit) ? rawLimit : Infinity;
    const normalizedLimit = limit > 0 ? limit : Infinity;
    const filterAdmins = this.getNodeParameter('filterAdmins', i, false);
    const filterBots = this.getNodeParameter('filterBots', i, false);
    const onlyOnline = this.getNodeParameter('onlyOnline', i, false);
    const excludeAdmins = this.getNodeParameter('excludeAdmins', i, false);
    const excludeBots = this.getNodeParameter('excludeBots', i, false);
    const excludeDeletedAndLongAgo = this.getNodeParameter('excludeDeletedAndLongAgo', i, false);
    const hasIncludeToggles = filterAdmins || filterBots || onlyOnline;
    const hasExcludeToggles = excludeAdmins || excludeBots || excludeDeletedAndLongAgo;
    const hasAnyToggle = hasIncludeToggles || hasExcludeToggles;
    const channel = await resolveChannelEntity(client, channelId);
    let allParticipants = [];
    const usersById = new Map();
    const fetchAllBeforeFiltering = hasAnyToggle || normalizedLimit === Infinity;
    if (channel instanceof teleproto_1.Api.Chat) {
        const result = (await (0, rateLimiter_1.withRateLimit)(async () => (0, floodWaitHandler_1.safeExecute)(() => client.invoke(new teleproto_1.Api.messages.GetFullChat({
            chatId: channel.id,
        })))));
        indexUsersById(usersById, result.users);
        const chatParticipants = result.fullChat instanceof teleproto_1.Api.ChatFull &&
            result.fullChat.participants instanceof teleproto_1.Api.ChatParticipants
            ? result.fullChat.participants.participants
            : [];
        allParticipants = chatParticipants
            .map((participant) => normalizeChatParticipant(participant))
            .filter((participant) => participant !== null);
    }
    else {
        const apiFilter = fetchAllBeforeFiltering
            ? new teleproto_1.Api.ChannelParticipantsSearch({ q: '' })
            : new teleproto_1.Api.ChannelParticipantsRecent();
        let offset = 0;
        let remaining = fetchAllBeforeFiltering ? Infinity : normalizedLimit;
        while (true) {
            const batchSize = remaining === Infinity ? 200 : Math.min(remaining, 200);
            const result = (await (0, rateLimiter_1.withRateLimit)(async () => (0, floodWaitHandler_1.safeExecute)(() => client.invoke(new teleproto_1.Api.channels.GetParticipants({
                channel,
                filter: apiFilter,
                offset,
                limit: batchSize,
                hash: big_integer_1.default.zero,
            })))));
            if (!(result instanceof teleproto_1.Api.channels.ChannelParticipants)) {
                break;
            }
            indexUsersById(usersById, result.users);
            const participantsBatch = result.participants
                .map((participant) => normalizeChannelParticipant(participant))
                .filter((participant) => participant !== null);
            allParticipants.push(...participantsBatch);
            offset += participantsBatch.length;
            if (remaining !== Infinity)
                remaining -= participantsBatch.length;
            if (participantsBatch.length < batchSize)
                break;
            if (remaining !== Infinity && remaining <= 0)
                break;
        }
    }
    let participants = allParticipants;
    const matchedByUserId = new Map();
    if (hasIncludeToggles) {
        const nowSec = Math.floor(Date.now() / 1000);
        participants = participants.filter((participant) => {
            const user = usersById.get(participant.userId);
            const reasons = [];
            if (filterAdmins && isParticipantAdmin(participant))
                reasons.push('admin');
            if (filterBots && (user === null || user === void 0 ? void 0 : user.bot) === true)
                reasons.push('bot');
            if (onlyOnline && isOnlineOrRecentlyActive(user === null || user === void 0 ? void 0 : user.status, nowSec))
                reasons.push('onlineOrRecent');
            const userId = participant.userId;
            if (reasons.length > 0 && userId) {
                matchedByUserId.set(userId, reasons);
            }
            return reasons.length > 0;
        });
    }
    else {
        for (const participant of participants) {
            const userId = participant.userId;
            if (userId)
                matchedByUserId.set(userId, ['allMembers']);
        }
    }
    if (excludeAdmins) {
        participants = participants.filter((participant) => !isParticipantAdmin(participant));
    }
    if (excludeBots) {
        participants = participants.filter((participant) => {
            const user = usersById.get(participant.userId);
            return (user === null || user === void 0 ? void 0 : user.bot) !== true;
        });
    }
    if (excludeDeletedAndLongAgo) {
        participants = participants.filter((participant) => {
            const user = usersById.get(participant.userId);
            if (!user)
                return false;
            return !isDeletedOrLongAgo(user);
        });
    }
    if (normalizedLimit !== Infinity) {
        participants = participants.slice(0, normalizedLimit);
    }
    const items = participants.map((participant) => {
        var _a;
        const user = usersById.get(participant.userId);
        const userId = participant.userId;
        return {
            json: {
                id: (_a = user === null || user === void 0 ? void 0 : user.id) === null || _a === void 0 ? void 0 : _a.toString(),
                username: (user === null || user === void 0 ? void 0 : user.username) || null,
                firstName: (user === null || user === void 0 ? void 0 : user.firstName) || '',
                lastName: (user === null || user === void 0 ? void 0 : user.lastName) || '',
                bot: (user === null || user === void 0 ? void 0 : user.bot) || false,
                isAdmin: isParticipantAdmin(participant),
                isCreator: isParticipantCreator(participant),
                status: getStatusType(user === null || user === void 0 ? void 0 : user.status) || 'Unknown',
                phone: (user === null || user === void 0 ? void 0 : user.phone) || null,
                matchedBy: userId ? matchedByUserId.get(userId) || [] : [],
            },
            pairedItem: { item: i },
        };
    });
    return items;
}
function getStatusType(status) {
    if (!status)
        return undefined;
    return getEntityTypeName(status);
}
function isOnlineOrRecentlyActive(status, nowSec) {
    const statusType = getStatusType(status);
    if (!statusType)
        return false;
    if (statusType === 'UserStatusOnline' || statusType === 'Online')
        return true;
    if (statusType === 'UserStatusRecently' || statusType === 'Recently')
        return true;
    const expiresRaw = status instanceof teleproto_1.Api.UserStatusOnline ? status.expires : undefined;
    const expires = typeof expiresRaw === 'bigint'
        ? Number(expiresRaw)
        : typeof expiresRaw === 'number'
            ? expiresRaw
            : undefined;
    return typeof expires === 'number' && expires > nowSec;
}
function isParticipantCreator(participant) {
    return participant.isCreator;
}
function isParticipantAdmin(participant) {
    return (participant.isAdmin || participant.adminRights != null || isParticipantCreator(participant));
}
function isDeletedOrLongAgo(user) {
    if (user.deleted === true)
        return true;
    const statusType = getStatusType(user.status);
    return statusType === 'UserStatusLongAgo' || statusType === 'LongAgo';
}
async function addChannelMember(client, i) {
    var _a, _b;
    const channelId = this.getNodeParameter('channelId', i);
    const userIdToAdd = this.getNodeParameter('userIdToAdd', i);
    const channel = await resolveChannelEntity(client, channelId);
    const user = await client.getEntity(userIdToAdd);
    try {
        await (0, rateLimiter_1.withRateLimit)(async () => (0, floodWaitHandler_1.safeExecute)(() => client.invoke(new teleproto_1.Api.channels.InviteToChannel({
            channel: channel,
            users: [user],
        }))));
        return [
            {
                json: {
                    success: true,
                    message: `Successfully added user ${userIdToAdd} to channel ${channelId}`,
                    userId: (_a = user.id) === null || _a === void 0 ? void 0 : _a.toString(),
                    channelId: (_b = channel.id) === null || _b === void 0 ? void 0 : _b.toString(),
                },
                pairedItem: { item: i },
            },
        ];
    }
    catch (error) {
        return [
            {
                json: {
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    message: `Failed to add user ${userIdToAdd} to channel ${channelId}`,
                },
                pairedItem: { item: i },
            },
        ];
    }
}
async function resolveChannelEntity(client, rawId) {
    const attempts = [];
    const asString = typeof rawId === 'string' ? rawId.trim() : String(rawId);
    if (/^\d+$/.test(asString) && !asString.startsWith('-')) {
        attempts.push(`-100${asString}`);
        attempts.push(`-${asString}`);
    }
    else if (asString.startsWith('-100')) {
        attempts.push(asString);
        attempts.push(asString.replace('-100', '-'));
    }
    else if (asString.startsWith('-')) {
        attempts.push(asString);
        attempts.push(asString.replace('-', '-100'));
    }
    else {
        attempts.push(asString);
    }
    let lastError = null;
    try {
        client.setLogLevel(Logger_1.LogLevel.NONE);
        for (const candidate of attempts) {
            try {
                const entity = await client.getEntity(candidate);
                if (isChannelEntity(entity)) {
                    return entity;
                }
                lastError = new Error(`Resolved entity for ${candidate} is a ${getEntityTypeName(entity)}, but expected a Channel or Chat`);
            }
            catch (err) {
                lastError = err;
            }
        }
    }
    finally {
        client.setLogLevel(Logger_1.LogLevel.ERROR);
    }
    throw lastError || new Error('Failed to resolve channel entity');
}
async function removeChannelMember(client, i) {
    var _a, _b;
    const channelId = this.getNodeParameter('channelId', i);
    const userIdToRemove = this.getNodeParameter('userIdToRemove', i);
    const channel = await resolveChannelEntity(client, channelId);
    const user = await client.getEntity(userIdToRemove);
    try {
        await (0, rateLimiter_1.withRateLimit)(async () => (0, floodWaitHandler_1.safeExecute)(() => client.invoke(new teleproto_1.Api.channels.EditBanned({
            channel: channel,
            participant: user,
            bannedRights: new teleproto_1.Api.ChatBannedRights({
                viewMessages: true,
                sendMessages: true,
                sendMedia: true,
                sendStickers: true,
                sendGifs: true,
                sendGames: true,
                sendInline: true,
                embedLinks: true,
                sendPolls: true,
                changeInfo: true,
                inviteUsers: true,
                pinMessages: true,
                untilDate: 0,
            }),
        }))));
        return [
            {
                json: {
                    success: true,
                    message: `Successfully removed user ${userIdToRemove} from channel ${channelId}`,
                    userId: (_a = user.id) === null || _a === void 0 ? void 0 : _a.toString(),
                    channelId: (_b = channel.id) === null || _b === void 0 ? void 0 : _b.toString(),
                },
                pairedItem: { item: i },
            },
        ];
    }
    catch (error) {
        return [
            {
                json: {
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    message: `Failed to remove user ${userIdToRemove} from channel ${channelId}`,
                },
                pairedItem: { item: i },
            },
        ];
    }
}
async function banUser(client, i) {
    var _a, _b;
    const channelId = this.getNodeParameter('channelId', i);
    const userIdToBan = this.getNodeParameter('userIdToBan', i);
    const banDuration = this.getNodeParameter('banDuration', i, 1);
    const banReason = this.getNodeParameter('banReason', i, '');
    const channel = await resolveChannelEntity(client, channelId);
    const user = await client.getEntity(userIdToBan);
    try {
        const banDurationNum = typeof banDuration === 'number' ? banDuration : parseInt(banDuration, 10);
        const untilDate = banDurationNum === 0 ? 0 : Math.floor(Date.now() / 1000) + banDurationNum * 24 * 60 * 60;
        await (0, rateLimiter_1.withRateLimit)(async () => (0, floodWaitHandler_1.safeExecute)(() => client.invoke(new teleproto_1.Api.channels.EditBanned({
            channel: channel,
            participant: user,
            bannedRights: new teleproto_1.Api.ChatBannedRights({
                viewMessages: true,
                sendMessages: true,
                sendMedia: true,
                sendStickers: true,
                sendGifs: true,
                sendGames: true,
                sendInline: true,
                embedLinks: true,
                sendPolls: true,
                changeInfo: true,
                inviteUsers: true,
                pinMessages: true,
                untilDate: untilDate,
            }),
        }))));
        return [
            {
                json: {
                    success: true,
                    message: `Successfully banned user ${userIdToBan} from channel ${channelId} for ${banDuration === 0 ? 'permanent' : banDuration + ' days'}`,
                    userId: (_a = user.id) === null || _a === void 0 ? void 0 : _a.toString(),
                    channelId: (_b = channel.id) === null || _b === void 0 ? void 0 : _b.toString(),
                    banDuration: banDuration,
                    banReason: banReason || 'No reason provided',
                },
                pairedItem: { item: i },
            },
        ];
    }
    catch (error) {
        return [
            {
                json: {
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    message: `Failed to ban user ${userIdToBan} from channel ${channelId}`,
                },
                pairedItem: { item: i },
            },
        ];
    }
}
async function unbanUser(client, i) {
    var _a, _b;
    const channelId = this.getNodeParameter('channelId', i);
    const userIdToUnban = this.getNodeParameter('userIdToUnban', i);
    const channel = await resolveChannelEntity(client, channelId);
    const user = await client.getEntity(userIdToUnban);
    try {
        await (0, rateLimiter_1.withRateLimit)(async () => (0, floodWaitHandler_1.safeExecute)(() => client.invoke(new teleproto_1.Api.channels.EditBanned({
            channel: channel,
            participant: user,
            bannedRights: new teleproto_1.Api.ChatBannedRights({
                viewMessages: false,
                sendMessages: false,
                sendMedia: false,
                sendStickers: false,
                sendGifs: false,
                sendGames: false,
                sendInline: false,
                embedLinks: false,
                sendPolls: false,
                changeInfo: false,
                inviteUsers: false,
                pinMessages: false,
                untilDate: 0,
            }),
        }))));
        return [
            {
                json: {
                    success: true,
                    message: `Successfully unbanned user ${userIdToUnban} from channel ${channelId}`,
                    userId: (_a = user.id) === null || _a === void 0 ? void 0 : _a.toString(),
                    channelId: (_b = channel.id) === null || _b === void 0 ? void 0 : _b.toString(),
                },
                pairedItem: { item: i },
            },
        ];
    }
    catch (error) {
        return [
            {
                json: {
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    message: `Failed to unban user ${userIdToUnban} from channel ${channelId}`,
                },
                pairedItem: { item: i },
            },
        ];
    }
}
async function promoteUser(client, i) {
    var _a, _b;
    const channelId = this.getNodeParameter('channelId', i);
    const userIdToPromote = this.getNodeParameter('userIdToPromote', i);
    const adminTitle = String(this.getNodeParameter('adminTitle', i, 'Admin'));
    const canChangeInfo = Boolean(this.getNodeParameter('canChangeInfo', i, false));
    const canPostMessages = Boolean(this.getNodeParameter('canPostMessages', i, false));
    const canEditMessages = Boolean(this.getNodeParameter('canEditMessages', i, false));
    const canDeleteMessages = Boolean(this.getNodeParameter('canDeleteMessages', i, true));
    const canInviteUsers = Boolean(this.getNodeParameter('canInviteUsers', i, true));
    const canRestrictMembers = Boolean(this.getNodeParameter('canRestrictMembers', i, true));
    const canPinMessages = Boolean(this.getNodeParameter('canPinMessages', i, true));
    const canPromoteMembers = Boolean(this.getNodeParameter('canPromoteMembers', i, false));
    const canManageChat = Boolean(this.getNodeParameter('canManageChat', i, true));
    const canManageVoiceChats = Boolean(this.getNodeParameter('canManageVoiceChats', i, true));
    const canPostStories = Boolean(this.getNodeParameter('canPostStories', i, false));
    const canEditStories = Boolean(this.getNodeParameter('canEditStories', i, false));
    const canDeleteStories = Boolean(this.getNodeParameter('canDeleteStories', i, false));
    const channel = await resolveChannelEntity(client, channelId);
    const user = await client.getEntity(userIdToPromote);
    try {
        await (0, rateLimiter_1.withRateLimit)(async () => (0, floodWaitHandler_1.safeExecute)(() => client.invoke(new teleproto_1.Api.channels.EditAdmin({
            channel: channel,
            userId: user,
            adminRights: new teleproto_1.Api.ChatAdminRights({
                changeInfo: canChangeInfo,
                postMessages: canPostMessages,
                editMessages: canEditMessages,
                deleteMessages: canDeleteMessages,
                banUsers: canRestrictMembers,
                inviteUsers: canInviteUsers,
                pinMessages: canPinMessages,
                addAdmins: canPromoteMembers,
                anonymous: false,
                manageCall: canManageVoiceChats,
                other: canManageChat,
                postStories: canPostStories,
                editStories: canEditStories,
                deleteStories: canDeleteStories,
            }),
            rank: adminTitle,
        }))));
        return [
            {
                json: {
                    success: true,
                    message: `Successfully promoted user ${userIdToPromote} to admin in channel ${channelId}`,
                    userId: (_a = user.id) === null || _a === void 0 ? void 0 : _a.toString(),
                    channelId: (_b = channel.id) === null || _b === void 0 ? void 0 : _b.toString(),
                    adminTitle: adminTitle,
                    permissions: {
                        canChangeInfo,
                        canPostMessages,
                        canEditMessages,
                        canDeleteMessages,
                        canInviteUsers,
                        canRestrictMembers,
                        canPinMessages,
                        canPromoteMembers,
                        canManageChat,
                        canManageVoiceChats,
                        canPostStories,
                        canEditStories,
                        canDeleteStories,
                    },
                },
                pairedItem: { item: i },
            },
        ];
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('RIGHT_FORBIDDEN') || errorMessage.includes('CHAT_ADMIN_REQUIRED')) {
            return [
                {
                    json: {
                        success: false,
                        error: "RIGHT_FORBIDDEN: You don't have permission to promote users to admin",
                        message: `You need admin rights with 'addAdmins' permission or be the channel creator to promote users in channel ${channelId}. Original Error: ${errorMessage}`,
                    },
                    pairedItem: { item: i },
                },
            ];
        }
        return [
            {
                json: {
                    success: false,
                    error: errorMessage,
                    message: `Failed to promote user ${userIdToPromote} to admin in channel ${channelId}`,
                },
                pairedItem: { item: i },
            },
        ];
    }
}
//# sourceMappingURL=channel.operations.js.map