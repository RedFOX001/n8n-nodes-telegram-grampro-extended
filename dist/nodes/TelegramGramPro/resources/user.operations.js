"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRouter = userRouter;
exports.getMe = getMe;
exports.getMeScoped = getMeScoped;
exports.getFullUser = getFullUser;
exports.getFullUserScoped = getFullUserScoped;
exports.updateProfile = updateProfile;
exports.updateUsername = updateUsername;
exports.getProfilePhoto = getProfilePhoto;
exports.updateStatus = updateStatus;
const clientManager_1 = require("../core/clientManager");
const floodWaitHandler_1 = require("../core/floodWaitHandler");
const teleproto_1 = require("teleproto");
const cache_1 = require("../core/cache");
function getBasicUser(users) {
    const user = users.find((candidate) => candidate instanceof teleproto_1.Api.User);
    if (!user) {
        throw new Error('Telegram did not return a usable user object.');
    }
    return user;
}
function getDetailedUser(fullUser) {
    if (!(fullUser instanceof teleproto_1.Api.UserFull)) {
        throw new Error('Telegram did not return full user details.');
    }
    return fullUser;
}
function isTelegramUserEntity(entity) {
    return entity instanceof teleproto_1.Api.User;
}
function getProfilePhotoParams(photoSize) {
    if (photoSize === 'full') {
        return undefined;
    }
    return {
        isBig: photoSize !== 'small',
    };
}
function ensureBinaryBuffer(data, context) {
    if (data === undefined) {
        return undefined;
    }
    if (Buffer.isBuffer(data)) {
        return data;
    }
    throw new Error(`Expected binary buffer from Telegram while ${context}, received a file path.`);
}
async function userRouter(operation, i) {
    const creds = (await this.getCredentials('telegramGramProApi'));
    const client = await (0, clientManager_1.getClient)(creds.apiId, creds.apiHash, creds.session);
    const cacheScope = buildCacheScope(creds);
    switch (operation) {
        case 'getMe':
            return getMeScoped.call(this, client, i, cacheScope);
        case 'getFullUser':
            return getFullUserScoped.call(this, client, i, cacheScope);
        case 'updateProfile':
            return updateProfile.call(this, client, i);
        case 'updateUsername':
            return updateUsername.call(this, client, i);
        case 'getProfilePhoto':
            return getProfilePhoto.call(this, client, i);
        case 'updateStatus':
            return updateStatus.call(this, client, i);
        default:
            throw new Error(`User operation not supported: ${operation}`);
    }
}
async function getMe(client, i) {
    return getMeScoped.call(this, client, i, 'global');
}
async function getMeScoped(client, i, cacheScope) {
    const cacheKey = `me:${cacheScope}`;
    const cachedMe = cache_1.cache.get(cacheKey);
    if (cachedMe) {
        return [
            {
                json: cachedMe,
                pairedItem: { item: i },
            },
        ];
    }
    const me = await client.getMe();
    if (!me) {
        throw new Error('Telegram did not return the current user.');
    }
    const meFullResult = await (0, floodWaitHandler_1.safeExecute)(() => client.invoke(new teleproto_1.Api.users.GetFullUser({
        id: 'me',
    })));
    const meFull = getDetailedUser(meFullResult.fullUser);
    const json = {
        id: me.id,
        username: me.username,
        firstName: me.firstName,
        lastName: me.lastName,
        bio: meFull.about || '',
        commonChatsCount: meFull.commonChatsCount || 0,
        isBot: me.bot || false,
        isContact: me.contact || false,
        isVerified: me.verified || false,
        isScam: me.scam || false,
        isFake: me.fake || false,
        isPremium: me.premium || false,
    };
    cache_1.cache.set(cacheKey, json);
    return [
        {
            json,
            pairedItem: { item: i },
        },
    ];
}
async function getFullUser(client, i) {
    return getFullUserScoped.call(this, client, i, 'global');
}
async function getFullUserScoped(client, i, cacheScope) {
    const userId = this.getNodeParameter('userId', i);
    const cacheKey = `${cache_1.CacheKeys.getUser(userId)}:${cacheScope}`;
    const cachedUser = cache_1.cache.get(cacheKey);
    if (cachedUser) {
        return [
            {
                json: cachedUser,
                pairedItem: { item: i },
            },
        ];
    }
    const result = (await (0, floodWaitHandler_1.safeExecute)(() => client.invoke(new teleproto_1.Api.users.GetFullUser({
        id: userId,
    }))));
    const full = getDetailedUser(result.fullUser);
    const basic = getBasicUser(result.users);
    const json = {
        id: basic.id.toString(),
        firstName: basic.firstName,
        lastName: basic.lastName,
        username: basic.username,
        bio: full.about || '',
        commonChatsCount: full.commonChatsCount,
        isBot: basic.bot,
        isContact: basic.contact,
        isVerified: basic.verified,
        isScam: basic.scam,
        isFake: basic.fake,
        canPinMessages: full.canPinMessage,
        videoNotes: false,
        isPremium: basic.premium,
        emojiStatus: basic.emojiStatus,
    };
    cache_1.cache.set(cacheKey, json);
    return [
        {
            json,
            pairedItem: { item: i },
        },
    ];
}
function buildCacheScope(creds) {
    const apiId = creds.apiId ? String(creds.apiId) : 'no-api-id';
    const session = typeof creds.session === 'string' ? creds.session : '';
    const tail = session.length >= 8 ? session.slice(-8) : session || 'no-session';
    return `${apiId}:${tail}`;
}
async function updateProfile(client, i) {
    const firstName = this.getNodeParameter('firstName', i, '');
    const lastName = this.getNodeParameter('lastName', i, '');
    const about = this.getNodeParameter('about', i, '');
    try {
        const result = (await (0, floodWaitHandler_1.safeExecute)(() => client.invoke(new teleproto_1.Api.account.UpdateProfile({
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            about: about || undefined,
        }))));
        const updatedUser = result instanceof teleproto_1.Api.User ? result : undefined;
        return [
            {
                json: {
                    success: true,
                    message: 'Profile updated successfully',
                    firstName: updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.firstName,
                    lastName: updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.lastName,
                    about,
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
                    message: 'Failed to update profile',
                },
                pairedItem: { item: i },
            },
        ];
    }
}
async function updateUsername(client, i) {
    var _a;
    const newUsername = this.getNodeParameter('newUsername', i, '');
    try {
        const result = (await (0, floodWaitHandler_1.safeExecute)(() => client.invoke(new teleproto_1.Api.account.UpdateUsername({
            username: newUsername,
        }))));
        const updatedUser = result instanceof teleproto_1.Api.User ? result : undefined;
        return [
            {
                json: {
                    success: true,
                    message: `Username updated to ${newUsername}`,
                    username: updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.username,
                    id: (_a = updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.id) === null || _a === void 0 ? void 0 : _a.toString(),
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
                    message: 'Failed to update username',
                },
                pairedItem: { item: i },
            },
        ];
    }
}
async function getProfilePhoto(client, i) {
    var _a, _b;
    const myProfilePhotoOnly = this.getNodeParameter('myProfilePhotoOnly', i, false);
    let userId;
    if (myProfilePhotoOnly) {
        const me = await client.getMe();
        if (!me) {
            throw new Error('Telegram did not return the current user.');
        }
        userId = me.id.toString();
    }
    else {
        userId = this.getNodeParameter('userId', i);
    }
    const photoSize = this.getNodeParameter('photoSize', i, 'medium');
    try {
        const entity = await client.getEntity(userId);
        if (!isTelegramUserEntity(entity)) {
            throw new Error(`Resolved entity for ${userId} is not a Telegram user.`);
        }
        const user = entity;
        if (!user.photo) {
            return [
                {
                    json: {
                        success: false,
                        message: 'User has no profile photo',
                        userId: (_a = user.id) === null || _a === void 0 ? void 0 : _a.toString(),
                    },
                    pairedItem: { item: i },
                },
            ];
        }
        const photoData = ensureBinaryBuffer(await client.downloadProfilePhoto(user, getProfilePhotoParams(photoSize)), 'downloading the profile photo');
        return [
            {
                json: {
                    success: true,
                    message: `Profile photo downloaded (${photoSize} size)`,
                    userId: (_b = user.id) === null || _b === void 0 ? void 0 : _b.toString(),
                    username: user.username,
                    firstName: user.firstName,
                    photoSize: photoSize,
                    photoData: photoData ? 'Binary data available' : 'No photo data',
                },
                binary: photoData
                    ? {
                        photo: {
                            data: photoData.toString('base64'),
                            mimeType: 'image/jpeg',
                            fileName: `profile_photo_${user.id}_${photoSize}.jpg`,
                        },
                    }
                    : undefined,
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
                    message: 'Failed to get profile photo',
                },
                pairedItem: { item: i },
            },
        ];
    }
}
async function updateStatus(client, i) {
    const offline = Boolean(this.getNodeParameter('offline', i));
    try {
        await client.invoke(new teleproto_1.Api.account.UpdateStatus({
            offline: offline,
        }));
        return [
            {
                json: {
                    success: true,
                    offline,
                    message: `Status changes to ${offline ? 'Offline' : 'Online'}`,
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
                    message: `Status Did not change to ${offline ? 'Offline' : 'Online'}`,
                },
                pairedItem: { item: i },
            },
        ];
    }
}
//# sourceMappingURL=user.operations.js.map