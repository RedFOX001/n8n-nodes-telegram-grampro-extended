"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramGramProApi = void 0;
exports.testTelegramApi = testTelegramApi;
const clientManager_1 = require("../nodes/TelegramGramPro/core/clientManager");
const telegramErrorMapper_1 = require("../nodes/TelegramGramPro/core/telegramErrorMapper");
class TelegramGramProApi {
    constructor() {
        this.name = 'telegramGramProApi';
        this.displayName = 'Telegram GramPro API';
        this.documentationUrl = 'https://github.com/sadiakant/n8n-nodes-telegram-grampro/blob/main/docs/AUTHORIZATION_GUIDE.md';
        this.icon = 'file:telegram-grampro-credentials.svg';
        this.properties = [
            {
                displayName: 'API ID',
                name: 'apiId',
                type: 'number',
                default: '',
                required: true,
                description: 'Your Telegram API ID from https://my.telegram.org (must be 6-9 digits)',
            },
            {
                displayName: 'API Hash',
                name: 'apiHash',
                type: 'string',
                default: '',
                required: true,
                description: 'Your Telegram API Hash from https://my.telegram.org (must be 32 characters)',
                placeholder: 'e.g., abc123def456ghi789jkl012mno345pq',
            },
            {
                displayName: 'Session String',
                name: 'session',
                type: 'string',
                typeOptions: {
                    password: true,
                },
                default: '',
                required: true,
                description: 'The session string obtained from the "Complete Login" operation. Paste the full string here.',
            },
        ];
        this.test = {
            request: {
                method: 'GET',
                url: 'https://telegram.org',
                ignoreHttpStatusErrors: true,
            },
        };
        this.authenticate = async (credentials, requestOptions) => {
            const apiIdRaw = credentials.apiId;
            const apiId = typeof apiIdRaw === 'string' ? Number(apiIdRaw) : apiIdRaw;
            const apiHash = credentials.apiHash;
            const session = credentials.session;
            if (!apiId || !apiHash) {
                throw new Error('API ID and API Hash are required');
            }
            if (!session || !session.trim()) {
                throw new Error('Session String is required. Run Auth > Complete Login first.');
            }
            try {
                const client = await (0, clientManager_1.getClient)(apiId, apiHash, session);
                if (!client) {
                    throw new Error('Failed to initialize Telegram client');
                }
                const me = await client.getMe();
                if (!me) {
                    throw new Error('Could not verify account identity with getMe');
                }
            }
            catch (error) {
                const mapped = (0, telegramErrorMapper_1.mapTelegramError)(error);
                throw new Error(`getMe verification failed: ${mapped.userMessage}`, {
                    cause: error,
                });
            }
            return requestOptions;
        };
    }
}
exports.TelegramGramProApi = TelegramGramProApi;
async function testTelegramApi(credential) {
    var _a;
    try {
        const credentials = ('data' in credential ? credential.data : credential);
        const apiIdRaw = credentials === null || credentials === void 0 ? void 0 : credentials.apiId;
        const apiId = typeof apiIdRaw === 'string' ? Number(apiIdRaw) : apiIdRaw;
        const apiHash = credentials === null || credentials === void 0 ? void 0 : credentials.apiHash;
        const session = credentials === null || credentials === void 0 ? void 0 : credentials.session;
        if (!apiId || !apiHash) {
            return {
                status: 'Error',
                message: 'API ID and API Hash are required',
            };
        }
        const client = await (0, clientManager_1.getClient)(apiId, apiHash, session !== null && session !== void 0 ? session : '');
        if (!client) {
            return {
                status: 'Error',
                message: 'Failed to initialize Telegram client',
            };
        }
        const me = await client.getMe();
        if (!me) {
            return {
                status: 'Error',
                message: 'getMe Operation Error: Could not verify account identity',
            };
        }
        const fullName = `${(_a = me.firstName) !== null && _a !== void 0 ? _a : ''}${me.lastName ? ` ${me.lastName}` : ''}`.trim() || 'Unknown';
        const username = me.username ? `@${me.username}` : 'no-username';
        const userId = me.id ? me.id.toString() : 'unknown-id';
        return {
            status: 'OK',
            message: `Connection tested successfully. Username: ${username}, UserID: ${userId}, Name: ${fullName}`,
        };
    }
    catch (error) {
        const mapped = (0, telegramErrorMapper_1.mapTelegramError)(error);
        return {
            status: 'Error',
            message: `getMe Operation Error: ${mapped.userMessage}`,
        };
    }
}
//# sourceMappingURL=TelegramGramProApi.credentials.js.map