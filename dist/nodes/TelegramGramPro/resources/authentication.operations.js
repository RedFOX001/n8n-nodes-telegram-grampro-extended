"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticationRouter = authenticationRouter;
const n8n_workflow_1 = require("n8n-workflow");
const teleproto_1 = require("teleproto");
const sessions_1 = require("teleproto/sessions");
const logger_1 = require("../core/logger");
const floodWaitHandler_1 = require("../core/floodWaitHandler");
const telegramErrorMapper_1 = require("../core/telegramErrorMapper");
const Logger_1 = require("teleproto/extensions/Logger");
const qrPng_1 = require("../core/qrPng");
const nodeOperationError_1 = require("../core/nodeOperationError");
function getOptionalPasswordParam(executor, paramName, itemIndex) {
    const rawValue = executor.getNodeParameter(paramName, itemIndex, '');
    if (typeof rawValue !== 'string')
        return '';
    const normalized = rawValue.trim();
    if (!normalized)
        return '';
    if (normalized.toLowerCase() === 'undefined' || normalized.toLowerCase() === 'null')
        return '';
    return rawValue;
}
const SENT_CODE_TYPE_MAP = {
    'auth.SentCodeTypeApp': 'app',
    'auth.SentCodeTypeSms': 'sms',
    'auth.SentCodeTypeCall': 'call',
    'auth.SentCodeTypeFlashCall': 'flash_call',
    'auth.SentCodeTypeMissedCall': 'missed_call',
    'auth.SentCodeTypeEmailCode': 'email_code',
    'auth.SentCodeTypeSetUpEmailRequired': 'setup_email_required',
    'auth.SentCodeTypeFragmentSms': 'fragment_sms',
    'auth.SentCodeTypeFirebaseSms': 'firebase_sms',
    'auth.SentCodeTypeSmsWord': 'sms_word',
    'auth.SentCodeTypeSmsPhrase': 'sms_phrase',
};
const CODE_TYPE_MAP = {
    'auth.CodeTypeSms': 'sms',
    'auth.CodeTypeCall': 'call',
    'auth.CodeTypeFlashCall': 'flash_call',
    'auth.CodeTypeMissedCall': 'missed_call',
    'auth.CodeTypeFragmentSms': 'fragment_sms',
};
const SENT_CODE_TYPE_FIELDS = {
    'auth.SentCodeTypeApp': ['length'],
    'auth.SentCodeTypeSms': ['length'],
    'auth.SentCodeTypeCall': ['length'],
    'auth.SentCodeTypeFlashCall': ['pattern'],
    'auth.SentCodeTypeMissedCall': ['prefix', 'length'],
    'auth.SentCodeTypeEmailCode': [
        'emailPattern',
        'length',
        'appleSigninAllowed',
        'googleSigninAllowed',
        'resetAvailablePeriod',
        'resetPendingDate',
    ],
    'auth.SentCodeTypeSetUpEmailRequired': ['appleSigninAllowed', 'googleSigninAllowed'],
    'auth.SentCodeTypeFragmentSms': ['url', 'length'],
    'auth.SentCodeTypeFirebaseSms': [
        'length',
        'pushTimeout',
        'receipt',
        'playIntegrityProjectId',
        'nonce',
        'playIntegrityNonce',
    ],
    'auth.SentCodeTypeSmsWord': ['beginning'],
    'auth.SentCodeTypeSmsPhrase': ['beginning'],
};
const CODE_TYPE_FIELDS = {
    'auth.CodeTypeSms': [],
    'auth.CodeTypeCall': [],
    'auth.CodeTypeFlashCall': [],
    'auth.CodeTypeMissedCall': [],
    'auth.CodeTypeFragmentSms': [],
};
function normalizeBinary(value) {
    if (Buffer.isBuffer(value))
        return value.toString('base64');
    if (value instanceof Uint8Array)
        return Buffer.from(value).toString('base64');
    return value;
}
function buildRawObject(obj, fields) {
    if (!obj || typeof obj !== 'object')
        return undefined;
    const asAny = obj;
    const className = typeof asAny.className === 'string' ? asAny.className : 'unknown';
    const raw = { className };
    for (const field of fields) {
        if (asAny[field] !== undefined) {
            raw[field] = normalizeBinary(asAny[field]);
        }
    }
    return raw;
}
function getTelegramClassName(value) {
    if (!value || typeof value !== 'object') {
        return undefined;
    }
    const maybeClassName = value.className;
    return typeof maybeClassName === 'string' ? maybeClassName : undefined;
}
function normalizeSentCodeType(type) {
    var _a, _b;
    if (!type)
        return {};
    const className = getTelegramClassName(type);
    const deliveryType = className ? ((_a = SENT_CODE_TYPE_MAP[className]) !== null && _a !== void 0 ? _a : className) : undefined;
    const fields = className ? ((_b = SENT_CODE_TYPE_FIELDS[className]) !== null && _b !== void 0 ? _b : []) : [];
    return {
        deliveryType,
        deliveryTypeRaw: buildRawObject(type, fields),
    };
}
function normalizeCodeType(type) {
    var _a, _b;
    if (!type)
        return {};
    const className = getTelegramClassName(type);
    const nextType = className ? ((_a = CODE_TYPE_MAP[className]) !== null && _a !== void 0 ? _a : className) : undefined;
    const fields = className ? ((_b = CODE_TYPE_FIELDS[className]) !== null && _b !== void 0 ? _b : []) : [];
    return {
        nextType,
        nextTypeRaw: buildRawObject(type, fields),
    };
}
function toBase64Url(value) {
    if (Buffer.isBuffer(value))
        return value.toString('base64url');
    if (value instanceof Uint8Array)
        return Buffer.from(value).toString('base64url');
    return undefined;
}
async function buildQrBinary(loginUrl, fileNamePrefix) {
    const buffer = (0, qrPng_1.generateQrPngBuffer)(loginUrl, {
        margin: 4,
        width: 320,
    });
    const fileName = (0, qrPng_1.getQrPngFileName)(fileNamePrefix);
    return {
        buffer,
        fileName,
        mimeType: 'image/png',
    };
}
function saveSessionString(client, context) {
    var _a, _b;
    const session = (_b = (_a = client.session).save) === null || _b === void 0 ? void 0 : _b.call(_a);
    if (typeof session !== 'string' || !session.trim()) {
        throw new Error(`Failed to obtain session string during ${context}.`);
    }
    return session;
}
async function invokeWithTimeout(context, fn, timeoutMs = 30000) {
    let timeoutHandle;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
            reject(new Error(`Timeout while waiting for Telegram during ${context}.`));
        }, timeoutMs);
    });
    try {
        return await Promise.race([fn(), timeoutPromise]);
    }
    finally {
        if (timeoutHandle)
            clearTimeout(timeoutHandle);
    }
}
async function forceCleanup(client, phone) {
    if (!client)
        return;
    try {
        client.setLogLevel(Logger_1.LogLevel.NONE);
        await client.disconnect();
        await client.destroy();
        logger_1.logger.info(`Cleanly disconnected auth client: ${phone}`);
    }
    catch {
    }
}
async function authenticationRouter(operation, i) {
    if (operation === 'requestCode')
        return requestCode.call(this, i);
    if (operation === 'resendCode')
        return resendCode.call(this, i);
    if (operation === 'requestQr')
        return requestQrLogin.call(this, i);
    if (operation === 'completeQr')
        return completeQrLogin.call(this, i);
    if (operation === 'signIn')
        return signIn.call(this, i);
    throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Auth operation ${operation} not supported.`, {
        itemIndex: i,
    });
}
function extractSentCodeDetails(sentCode) {
    var _a;
    const isCodeViaApp = sentCode.type instanceof teleproto_1.Api.auth.SentCodeTypeApp;
    const { deliveryType, deliveryTypeRaw } = normalizeSentCodeType(sentCode.type);
    const { nextType, nextTypeRaw } = normalizeCodeType(sentCode.nextType);
    return {
        phoneCodeHash: sentCode.phoneCodeHash,
        isCodeViaApp,
        deliveryType,
        deliveryTypeRaw,
        nextType,
        nextTypeRaw,
        timeout: (_a = sentCode.timeout) !== null && _a !== void 0 ? _a : undefined,
    };
}
async function requestCode(i) {
    const rawApiId = this.getNodeParameter('apiId', i);
    const apiId = parseInt(rawApiId, 10);
    const apiHash = this.getNodeParameter('apiHash', i);
    const phoneNumber = this.getNodeParameter('phoneNumber', i);
    const password2fa = getOptionalPasswordParam(this, 'password2fa', i);
    const client = new teleproto_1.TelegramClient(new sessions_1.StringSession(''), apiId, apiHash, {
        connectionRetries: 1,
        autoReconnect: false,
    });
    let phoneCodeHash;
    let isCodeViaApp;
    let deliveryType;
    let deliveryTypeRaw;
    let nextType;
    let nextTypeRaw;
    let timeout;
    let preAuthSession;
    let sessionString;
    try {
        await client.connect();
        const result = (await (0, floodWaitHandler_1.safeExecute)(() => client.invoke(new teleproto_1.Api.auth.SendCode({
            phoneNumber,
            apiId,
            apiHash,
            settings: new teleproto_1.Api.CodeSettings({}),
        }))));
        if (getTelegramClassName(result) === 'auth.SentCodePaymentRequired') {
            throw new Error('Telegram requires a paid login delivery method for this phone number. Use the official app or upgrade Telegram to complete login.');
        }
        if (result instanceof teleproto_1.Api.auth.SentCodeSuccess) {
            sessionString = saveSessionString(client, 'requestCode');
        }
        else {
            const details = extractSentCodeDetails(result);
            phoneCodeHash = details.phoneCodeHash;
            isCodeViaApp = details.isCodeViaApp;
            deliveryType = details.deliveryType;
            deliveryTypeRaw = details.deliveryTypeRaw;
            nextType = details.nextType;
            nextTypeRaw = details.nextTypeRaw;
            timeout = details.timeout;
            preAuthSession = saveSessionString(client, 'requestCode');
        }
        if (!sessionString && !phoneCodeHash) {
            throw new Error('Failed to obtain phoneCodeHash from Telegram. Cannot continue authentication.');
        }
    }
    catch (error) {
        logger_1.logger.error(`RequestCode failed: ${error}`);
        throw (0, nodeOperationError_1.asNodeOperationError)(error, { context: this, itemIndex: i });
    }
    finally {
        await forceCleanup(client, phoneNumber);
    }
    if (sessionString) {
        return [
            {
                json: {
                    success: true,
                    sessionString,
                    apiId,
                    apiHash,
                    phoneNumber,
                    password2fa,
                    message: 'Telegram returned an authorized session without requiring a login code.',
                    note: 'You can use this session string directly in GramPro credentials.',
                },
                pairedItem: { item: i },
            },
        ];
    }
    if (!phoneCodeHash) {
        throw new Error('Failed to obtain phoneCodeHash from Telegram. Cannot continue authentication.');
    }
    return [
        {
            json: {
                success: true,
                phoneCodeHash,
                isCodeViaApp,
                preAuthSession,
                deliveryType,
                deliveryTypeRaw,
                nextType,
                nextTypeRaw,
                timeout,
                apiId,
                apiHash,
                phoneNumber,
                password2fa,
                note: 'IMPORTANT: Check your phone for the verification code.',
            },
            pairedItem: { item: i },
        },
    ];
}
async function resendCode(i) {
    const rawApiId = this.getNodeParameter('apiId', i);
    const apiId = parseInt(rawApiId, 10);
    const apiHash = this.getNodeParameter('apiHash', i);
    const phoneNumber = this.getNodeParameter('phoneNumber', i);
    const phoneCodeHash = this.getNodeParameter('phoneCodeHash', i);
    const preAuthSession = this.getNodeParameter('preAuthSession', i);
    const password2fa = getOptionalPasswordParam(this, 'password2fa', i);
    const client = new teleproto_1.TelegramClient(new sessions_1.StringSession(preAuthSession), apiId, apiHash, {
        connectionRetries: 1,
        autoReconnect: false,
    });
    let details;
    let sessionString;
    try {
        await client.connect();
        const result = (await (0, floodWaitHandler_1.safeExecute)(() => client.invoke(new teleproto_1.Api.auth.ResendCode({ phoneNumber, phoneCodeHash }))));
        if (getTelegramClassName(result) === 'auth.SentCodePaymentRequired') {
            throw new Error('Telegram requires a paid login delivery method for this phone number. Use the official app or upgrade Telegram to complete login.');
        }
        if (result instanceof teleproto_1.Api.auth.SentCodeSuccess) {
            sessionString = saveSessionString(client, 'resendCode');
        }
        else {
            details = extractSentCodeDetails(result);
        }
    }
    catch (error) {
        logger_1.logger.error(`ResendCode failed: ${error}`);
        throw (0, nodeOperationError_1.asNodeOperationError)(error, { context: this, itemIndex: i });
    }
    finally {
        await forceCleanup(client, phoneNumber);
    }
    if (sessionString) {
        return [
            {
                json: {
                    success: true,
                    sessionString,
                    apiId,
                    apiHash,
                    phoneNumber,
                    password2fa,
                    message: 'Telegram returned an authorized session without requiring a login code.',
                    note: 'You can use this session string directly in GramPro credentials.',
                },
                pairedItem: { item: i },
            },
        ];
    }
    if (!(details === null || details === void 0 ? void 0 : details.phoneCodeHash)) {
        throw new Error('Failed to resend login code. No phoneCodeHash returned by Telegram.');
    }
    return [
        {
            json: {
                success: true,
                phoneCodeHash: details.phoneCodeHash,
                isCodeViaApp: details.isCodeViaApp,
                preAuthSession,
                deliveryType: details.deliveryType,
                deliveryTypeRaw: details.deliveryTypeRaw,
                nextType: details.nextType,
                nextTypeRaw: details.nextTypeRaw,
                timeout: details.timeout,
                apiId,
                apiHash,
                phoneNumber,
                password2fa,
                note: 'IMPORTANT: Check your phone for the verification code.',
            },
            pairedItem: { item: i },
        },
    ];
}
async function requestQrLogin(i) {
    var _a;
    const rawApiId = this.getNodeParameter('apiId', i);
    const apiId = parseInt(rawApiId, 10);
    const apiHash = this.getNodeParameter('apiHash', i);
    let client = new teleproto_1.TelegramClient(new sessions_1.StringSession(''), apiId, apiHash, {
        connectionRetries: 1,
        autoReconnect: false,
    });
    let preAuthSession;
    let loginToken;
    let loginUrl;
    let expires;
    let qrBinary;
    try {
        await client.connect();
        let result = (await invokeWithTimeout('requestQr', () => (0, floodWaitHandler_1.safeExecute)(() => client.invoke(new teleproto_1.Api.auth.ExportLoginToken({
            apiId,
            apiHash,
            exceptIds: [],
        })))));
        if (result instanceof teleproto_1.Api.auth.LoginTokenMigrateTo) {
            const migrateDcId = result.dcId;
            const dcInfo = await client.getDC(migrateDcId, false);
            await forceCleanup(client, 'qr-login-request-disconnect');
            const migratedClient = new teleproto_1.TelegramClient(new sessions_1.StringSession(''), apiId, apiHash, {
                connectionRetries: 5,
                autoReconnect: true,
            });
            migratedClient.session.setDC(migrateDcId, dcInfo.ipAddress, dcInfo.port);
            await migratedClient.connect();
            client = migratedClient;
            result = (await invokeWithTimeout('requestQr', () => (0, floodWaitHandler_1.safeExecute)(() => client.invoke(new teleproto_1.Api.auth.ExportLoginToken({
                apiId,
                apiHash,
                exceptIds: [],
            })))));
        }
        if (result instanceof teleproto_1.Api.auth.LoginTokenSuccess) {
            const sessionString = saveSessionString(client, 'requestQr');
            return [
                {
                    json: {
                        success: true,
                        sessionString,
                        apiId,
                        apiHash,
                        message: 'QR login already completed. Session string is ready to use.',
                    },
                    pairedItem: { item: i },
                },
            ];
        }
        if (!(result instanceof teleproto_1.Api.auth.LoginToken)) {
            throw new Error(`Unexpected QR token response: ${(_a = getTelegramClassName(result)) !== null && _a !== void 0 ? _a : 'unknown'}`);
        }
        const token = toBase64Url(result.token);
        if (!token)
            throw new Error('Failed to generate QR login token.');
        preAuthSession = saveSessionString(client, 'requestQr');
        loginToken = token;
        loginUrl = `tg://login?token=${token}`;
        expires = result.expires;
        const qrFile = await buildQrBinary(loginUrl, 'telegram-qr');
        qrBinary = {
            data: qrFile.buffer.toString('base64'),
            fileName: qrFile.fileName,
            mimeType: qrFile.mimeType,
        };
    }
    catch (error) {
        logger_1.logger.error(`RequestQrLogin failed: ${error}`);
        throw (0, nodeOperationError_1.asNodeOperationError)(error, { context: this, itemIndex: i });
    }
    finally {
        await forceCleanup(client, 'qr-login');
    }
    return [
        {
            json: {
                success: true,
                loginToken,
                loginUrl,
                expires,
                preAuthSession,
                apiId,
                apiHash,
                note: 'Scan the QR in Telegram. Then run Complete QR Login with the preAuthSession.',
            },
            binary: qrBinary ? { qr: qrBinary } : undefined,
            pairedItem: { item: i },
        },
    ];
}
async function completeQrLogin(i) {
    var _a;
    const rawApiId = this.getNodeParameter('apiId', i);
    const apiId = parseInt(rawApiId, 10);
    const apiHash = this.getNodeParameter('apiHash', i);
    const preAuthSession = this.getNodeParameter('preAuthSession', i);
    const password2fa = getOptionalPasswordParam(this, 'password2fa', i);
    let client = new teleproto_1.TelegramClient(new sessions_1.StringSession(preAuthSession), apiId, apiHash, {
        connectionRetries: 1,
        autoReconnect: false,
    });
    try {
        await client.connect();
        let result = (await invokeWithTimeout('completeQr', () => (0, floodWaitHandler_1.safeExecute)(() => client.invoke(new teleproto_1.Api.auth.ExportLoginToken({
            apiId,
            apiHash,
            exceptIds: [],
        })))));
        if (result instanceof teleproto_1.Api.auth.LoginTokenSuccess) {
            const sessionString = saveSessionString(client, 'completeQr');
            return [
                {
                    json: {
                        success: true,
                        sessionString,
                        apiId,
                        apiHash,
                        message: 'QR login successful. Use this session string in GramPro credentials.',
                    },
                    pairedItem: { item: i },
                },
            ];
        }
        if (result instanceof teleproto_1.Api.auth.LoginTokenMigrateTo) {
            const migrateToken = result.token;
            const migrateDcId = result.dcId;
            const dcInfo = await client.getDC(migrateDcId, false);
            await forceCleanup(client, 'qr-login-disconnect');
            const migratedClient = new teleproto_1.TelegramClient(new sessions_1.StringSession(''), apiId, apiHash, {
                connectionRetries: 5,
                autoReconnect: true,
            });
            migratedClient.session.setDC(migrateDcId, dcInfo.ipAddress, dcInfo.port);
            await migratedClient.connect();
            client = migratedClient;
            result = (await invokeWithTimeout('completeQr', () => (0, floodWaitHandler_1.safeExecute)(() => client.invoke(new teleproto_1.Api.auth.ImportLoginToken({ token: migrateToken })))));
        }
        if (result instanceof teleproto_1.Api.auth.LoginTokenSuccess) {
            const sessionString = saveSessionString(client, 'completeQr');
            return [
                {
                    json: {
                        success: true,
                        sessionString,
                        apiId,
                        apiHash,
                        message: 'QR login successful. Use this session string in GramPro credentials.',
                    },
                    pairedItem: { item: i },
                },
            ];
        }
        if (!(result instanceof teleproto_1.Api.auth.LoginToken)) {
            throw new Error(`Unexpected QR token response: ${(_a = getTelegramClassName(result)) !== null && _a !== void 0 ? _a : 'unknown'}`);
        }
        const token = toBase64Url(result.token);
        if (!token)
            throw new Error('Failed to generate QR login token.');
        const qrFile = await buildQrBinary(`tg://login?token=${token}`, 'telegram-qr');
        return [
            {
                json: {
                    success: true,
                    status: 'pending',
                    loginToken: token,
                    loginUrl: `tg://login?token=${token}`,
                    expires: result.expires,
                    preAuthSession,
                    apiId,
                    apiHash,
                    note: 'QR not accepted yet. Token changes each request; scan the latest QR and retry.',
                },
                binary: {
                    qr: {
                        data: qrFile.buffer.toString('base64'),
                        fileName: qrFile.fileName,
                        mimeType: qrFile.mimeType,
                    },
                },
                pairedItem: { item: i },
            },
        ];
    }
    catch (error) {
        const mappedError = (0, telegramErrorMapper_1.mapTelegramError)(error);
        if (mappedError.code === 'SESSION_PASSWORD_NEEDED') {
            if (!password2fa) {
                throw (0, nodeOperationError_1.createNodeOperationError)('Two-step verification is enabled. Provide your 2FA password in the Complete QR Login operation.', { context: this, itemIndex: i, cause: error });
            }
            await invokeWithTimeout('signInWithPassword_completeQr', () => (0, floodWaitHandler_1.safeExecute)(() => client.signInWithPassword({ apiId, apiHash }, {
                password: async () => password2fa,
                onError: async (e) => {
                    throw (0, nodeOperationError_1.asNodeOperationError)(e, { context: this, itemIndex: i });
                },
            })));
            const sessionString = saveSessionString(client, 'completeQr');
            return [
                {
                    json: {
                        success: true,
                        sessionString,
                        apiId,
                        apiHash,
                        message: 'QR login successful after 2FA verification.',
                    },
                    pairedItem: { item: i },
                },
            ];
        }
        logger_1.logger.error(`CompleteQrLogin failed: ${error}`);
        throw (0, nodeOperationError_1.asNodeOperationError)(error, { context: this, itemIndex: i });
    }
    finally {
        await forceCleanup(client, 'qr-login');
    }
}
async function signIn(i) {
    const rawApiId = this.getNodeParameter('apiId', i);
    const apiId = parseInt(rawApiId, 10);
    const apiHash = this.getNodeParameter('apiHash', i);
    const phoneNumber = this.getNodeParameter('phoneNumber', i);
    const phoneCode = this.getNodeParameter('phoneCode', i);
    const phoneCodeHash = this.getNodeParameter('phoneCodeHash', i);
    const preAuthSession = this.getNodeParameter('preAuthSession', i);
    const password2fa = getOptionalPasswordParam(this, 'password2fa', i);
    const client = new teleproto_1.TelegramClient(new sessions_1.StringSession(preAuthSession), apiId, apiHash, {
        connectionRetries: 1,
        autoReconnect: false,
    });
    let sessionString;
    try {
        await client.connect();
        try {
            await (0, floodWaitHandler_1.safeExecute)(() => client.invoke(new teleproto_1.Api.auth.SignIn({ phoneNumber, phoneCodeHash, phoneCode })));
        }
        catch (err) {
            const mappedError = (0, telegramErrorMapper_1.mapTelegramError)(err);
            const is2faError = mappedError.code === 'SESSION_PASSWORD_NEEDED';
            if (!is2faError)
                throw (0, nodeOperationError_1.asNodeOperationError)(err, { context: this, itemIndex: i });
            if (!password2fa) {
                throw (0, nodeOperationError_1.createNodeOperationError)('Two-step verification is enabled on this account. Please provide the 2FA password.', { context: this, itemIndex: i, cause: err });
            }
            await invokeWithTimeout('signInWithPassword_signIn', () => (0, floodWaitHandler_1.safeExecute)(() => client.signInWithPassword({ apiId, apiHash }, {
                password: async () => password2fa,
                onError: async (e) => {
                    throw (0, nodeOperationError_1.asNodeOperationError)(e, { context: this, itemIndex: i });
                },
            })));
        }
        sessionString = saveSessionString(client, 'signIn');
    }
    catch (error) {
        logger_1.logger.error(`SignIn failed: ${error}`);
        throw (0, nodeOperationError_1.asNodeOperationError)(error, { context: this, itemIndex: i });
    }
    finally {
        await forceCleanup(client, phoneNumber);
    }
    return [
        {
            json: {
                success: true,
                sessionString,
                apiId,
                apiHash,
                phoneNumber,
                password2fa,
                message: 'Authentication successful. You can use this output to fill up new credentials to use all Telegram nodes.',
                note: 'IMPORTANT: Copy this whole output and save it to a text file in your local PC for backup and use in GramPro Credentials.',
            },
            pairedItem: { item: i },
        },
    ];
}
//# sourceMappingURL=authentication.operations.js.map