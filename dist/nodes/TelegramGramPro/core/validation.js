"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommonValidators = exports.ValidationPatterns = exports.EnhancedValidator = exports.ValidationException = void 0;
exports.validateSessionString = validateSessionString;
exports.validatePhoneNumber = validatePhoneNumber;
exports.validateChatId = validateChatId;
exports.validateMessageText = validateMessageText;
exports.validateMessageId = validateMessageId;
exports.validateUserId = validateUserId;
exports.validateOperationParams = validateOperationParams;
exports.validateAll = validateAll;
function toStringValue(value) {
    return typeof value === 'string' ? value : String(value);
}
class ValidationException extends Error {
    constructor(errors, message) {
        super(message || `Validation failed with ${errors.length} error(s)`);
        this.errors = errors;
        this.name = 'ValidationException';
    }
}
exports.ValidationException = ValidationException;
class EnhancedValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
    }
    validateField(fieldName, value, rules = {}) {
        if (rules.required && (value === undefined || value === null || value === '')) {
            this.addError(fieldName, `${fieldName} is required`, 'REQUIRED');
            return this;
        }
        if (!rules.required && (value === undefined || value === null || value === '')) {
            return this;
        }
        if (rules.type) {
            const actualType = Array.isArray(value) ? 'array' : typeof value;
            if (actualType !== rules.type) {
                this.addError(fieldName, `${fieldName} must be of type ${rules.type}`, 'INVALID_TYPE');
                return this;
            }
        }
        if (typeof value === 'string') {
            if (rules.minLength && value.length < rules.minLength) {
                this.addError(fieldName, `${fieldName} must be at least ${rules.minLength} characters long`, 'MIN_LENGTH');
            }
            if (rules.maxLength && value.length > rules.maxLength) {
                this.addError(fieldName, `${fieldName} cannot exceed ${rules.maxLength} characters`, 'MAX_LENGTH');
            }
            if (rules.pattern && !rules.pattern.test(value)) {
                this.addError(fieldName, `${fieldName} format is invalid`, 'INVALID_FORMAT');
            }
        }
        if (typeof value === 'number') {
            if (rules.min !== undefined && value < rules.min) {
                this.addError(fieldName, `${fieldName} must be at least ${rules.min}`, 'MIN_VALUE');
            }
            if (rules.max !== undefined && value > rules.max) {
                this.addError(fieldName, `${fieldName} cannot exceed ${rules.max}`, 'MAX_VALUE');
            }
        }
        if (rules.custom) {
            const customError = rules.custom(value);
            if (customError) {
                this.addError(fieldName, customError, 'CUSTOM');
            }
        }
        return this;
    }
    addError(field, message, code) {
        this.errors.push({ field, message, code });
    }
    addWarning(message) {
        this.warnings.push(message);
        return this;
    }
    isValid() {
        return this.errors.length === 0;
    }
    getErrors() {
        return this.errors;
    }
    getWarnings() {
        return this.warnings;
    }
    throwIfInvalid() {
        if (!this.isValid()) {
            throw new ValidationException(this.errors);
        }
    }
    getErrorMessage() {
        return this.errors.map((err) => `${err.field}: ${err.message}`).join('; ');
    }
    reset() {
        this.errors = [];
        this.warnings = [];
        return this;
    }
}
exports.EnhancedValidator = EnhancedValidator;
exports.ValidationPatterns = {
    PHONE: /^[+]?[1-9]\d{1,14}$/,
    API_ID: /^\d{6,9}$/,
    API_HASH: /^[a-f0-9]{32}$/i,
    USERNAME: /^@?[a-zA-Z0-9_]{5,32}$/,
    CHAT_ID: /^(@[a-zA-Z0-9_]{5,32}|t\.me\/[a-zA-Z0-9_]+|-?\d+)$/,
    MESSAGE_ID: /^\d+$/,
    URL: /^https?:\/\/.+/,
};
exports.CommonValidators = {
    validateApiCredentials(apiId, apiHash) {
        return new EnhancedValidator()
            .validateField('apiId', apiId, {
            required: true,
            type: 'string',
            pattern: exports.ValidationPatterns.API_ID,
            custom: (value) => {
                const num = parseInt(toStringValue(value), 10);
                if (isNaN(num) || num < 100000 || num > 999999999) {
                    return 'API ID must be a valid number between 100000 and 999999999';
                }
                return null;
            },
        })
            .validateField('apiHash', apiHash, {
            required: true,
            type: 'string',
            minLength: 32,
            maxLength: 32,
            pattern: exports.ValidationPatterns.API_HASH,
        });
    },
    validatePhoneNumber(phoneNumber) {
        return new EnhancedValidator().validateField('phoneNumber', phoneNumber, {
            required: true,
            type: 'string',
            pattern: exports.ValidationPatterns.PHONE,
            custom: (value) => {
                if (typeof value !== 'string') {
                    return 'Phone number must be a string';
                }
                const cleanNumber = value.replace(/[\s\-()]/g, '');
                if (cleanNumber.length < 8) {
                    return 'Phone number seems unusually short';
                }
                if (cleanNumber.length > 15) {
                    return 'Phone number seems unusually long';
                }
                return null;
            },
        });
    },
    validateChatId(chatId) {
        return new EnhancedValidator().validateField('chatId', chatId, {
            required: true,
            type: 'string',
            maxLength: 200,
            custom: (value) => {
                if (typeof value !== 'string') {
                    return 'Chat ID must be a string';
                }
                const trimmed = value.trim();
                if (!exports.ValidationPatterns.CHAT_ID.test(trimmed)) {
                    return 'Chat ID must be a username (@channel), invite link (t.me/...), or numeric ID';
                }
                return null;
            },
        });
    },
    validateMessageText(text) {
        return new EnhancedValidator().validateField('text', text, {
            type: 'string',
            maxLength: 4096,
            custom: (value) => {
                if (typeof value === 'string' && value.trim().length === 0) {
                    return 'Message text cannot be empty';
                }
                return null;
            },
        });
    },
    validateMessageId(messageId) {
        return new EnhancedValidator().validateField('messageId', messageId, {
            required: true,
            pattern: exports.ValidationPatterns.MESSAGE_ID,
            custom: (value) => {
                const id = parseInt(toStringValue(value), 10);
                if (isNaN(id) || id < 0) {
                    return 'Message ID must be a valid non-negative number';
                }
                return null;
            },
        });
    },
    validateUserId(userId) {
        return new EnhancedValidator().validateField('userId', userId, {
            required: true,
            type: 'string',
            custom: (value) => {
                if (typeof value !== 'string') {
                    return 'User ID must be a string';
                }
                if (exports.ValidationPatterns.USERNAME.test(value)) {
                    return null;
                }
                if (exports.ValidationPatterns.MESSAGE_ID.test(value)) {
                    return null;
                }
                return 'User ID must be a username (@username) or numeric ID';
            },
        });
    },
};
function validateSessionString(session) {
    const result = {
        isValid: true,
        errors: [],
        warnings: [],
    };
    if (!session) {
        result.errors.push('Session string is required');
        result.isValid = false;
    }
    else if (typeof session !== 'string') {
        result.errors.push('Session string must be a string');
        result.isValid = false;
    }
    else if (session.length < 10) {
        result.errors.push('Session string appears to be too short');
        result.isValid = false;
    }
    return result;
}
function validatePhoneNumber(phoneNumber) {
    const result = {
        isValid: true,
        errors: [],
        warnings: [],
    };
    if (!phoneNumber) {
        result.errors.push('Phone number is required');
        result.isValid = false;
    }
    else if (typeof phoneNumber !== 'string') {
        result.errors.push('Phone number must be a string');
        result.isValid = false;
    }
    else {
        const cleanNumber = phoneNumber.replace(/[\s\-()]/g, '');
        if (!/^[+]?[1-9]\d{1,14}$/.test(cleanNumber)) {
            result.errors.push('Phone number must be in international format (e.g., +1234567890)');
            result.isValid = false;
        }
        else if (cleanNumber.length < 8) {
            result.warnings.push('Phone number seems unusually short');
        }
        else if (cleanNumber.length > 15) {
            result.warnings.push('Phone number seems unusually long');
        }
    }
    return result;
}
function validateChatId(chatId) {
    const result = {
        isValid: true,
        errors: [],
        warnings: [],
    };
    if (!chatId) {
        result.errors.push('Chat ID is required');
        result.isValid = false;
    }
    else if (typeof chatId !== 'string') {
        result.errors.push('Chat ID must be a string');
        result.isValid = false;
    }
    else {
        const trimmed = chatId.trim();
        if (trimmed.length === 0) {
            result.errors.push('Chat ID cannot be empty');
            result.isValid = false;
        }
        else if (trimmed.length > 200) {
            result.warnings.push('Chat ID seems unusually long');
        }
    }
    return result;
}
function validateMessageText(text) {
    const result = {
        isValid: true,
        errors: [],
        warnings: [],
    };
    if (typeof text !== 'string') {
        result.errors.push('Message text must be a string');
        result.isValid = false;
    }
    else if (text.length === 0) {
        result.warnings.push('Message text is empty');
    }
    else if (text.length > 4096) {
        result.errors.push('Message text cannot exceed 4096 characters');
        result.isValid = false;
    }
    return result;
}
function validateMessageId(messageId) {
    const result = {
        isValid: true,
        errors: [],
        warnings: [],
    };
    if (!messageId && messageId !== 0) {
        result.errors.push('Message ID is required');
        result.isValid = false;
    }
    else if (typeof messageId !== 'number' && typeof messageId !== 'string') {
        result.errors.push('Message ID must be a number or string');
        result.isValid = false;
    }
    else {
        const numericId = typeof messageId === 'string' ? parseInt(messageId, 10) : messageId;
        if (isNaN(numericId) || numericId < 0) {
            result.errors.push('Message ID must be a valid non-negative number');
            result.isValid = false;
        }
    }
    return result;
}
function validateUserId(userId) {
    const result = {
        isValid: true,
        errors: [],
        warnings: [],
    };
    if (!userId) {
        result.errors.push('User ID is required');
        result.isValid = false;
    }
    else if (typeof userId !== 'string') {
        result.errors.push('User ID must be a string');
        result.isValid = false;
    }
    else {
        const trimmed = userId.trim();
        if (trimmed.length === 0) {
            result.errors.push('User ID cannot be empty');
            result.isValid = false;
        }
        else if (trimmed.length > 100) {
            result.warnings.push('User ID seems unusually long');
        }
    }
    return result;
}
function validateOperationParams(operation, params) {
    const result = {
        isValid: true,
        errors: [],
        warnings: [],
    };
    switch (operation) {
        case 'sendText':
            if (!params.chatId) {
                result.errors.push('Chat ID is required for sendText operation');
                result.isValid = false;
            }
            if (!params.text) {
                result.errors.push('Message text is required for sendText operation');
                result.isValid = false;
            }
            break;
        case 'editMessage':
            if (!params.chatId) {
                result.errors.push('Chat ID is required for editMessage operation');
                result.isValid = false;
            }
            if (!params.messageId) {
                result.errors.push('Message ID is required for editMessage operation');
                result.isValid = false;
            }
            if (!params.text) {
                result.errors.push('Message text is required for editMessage operation');
                result.isValid = false;
            }
            break;
        case 'editMessageMedia':
            if (!params.chatId) {
                result.errors.push('Chat ID is required for editMessageMedia operation');
                result.isValid = false;
            }
            if (!params.messageId) {
                result.errors.push('Message ID is required for editMessageMedia operation');
                result.isValid = false;
            }
            if (!params.media) {
                result.errors.push('Media is required for editMessageMedia operation');
                result.isValid = false;
            }
            break;
        case 'forwardMessage':
        case 'copyMessage':
            if (!params.sourceChatId) {
                result.errors.push(`Source Chat ID is required for ${operation} operation`);
                result.isValid = false;
            }
            if (!params.messageId) {
                result.errors.push(`Message ID is required for ${operation} operation`);
                result.isValid = false;
            }
            if (!params.saveToSavedMessages && !params.targetChatId) {
                result.errors.push(`Target Chat ID or Saved Messages toggle is required for ${operation} operation`);
                result.isValid = false;
            }
            break;
        case 'unpinMessage':
            if (!params.chatId) {
                result.errors.push('Chat ID is required for unpinMessage operation');
                result.isValid = false;
            }
            if (!params.messageId) {
                result.errors.push('Message ID is required for unpinMessage operation');
                result.isValid = false;
            }
            break;
        case 'deleteHistory':
            if (!params.chatId) {
                result.errors.push('Chat ID is required for deleteHistory operation');
                result.isValid = false;
            }
            break;
        case 'sendPoll':
            if (!params.chatId) {
                result.errors.push('Chat ID is required for sendPoll operation');
                result.isValid = false;
            }
            if (!params.pollQuestion) {
                result.errors.push('Poll question is required');
                result.isValid = false;
            }
            if (!Array.isArray(params.pollOptions) || params.pollOptions.length < 2) {
                result.errors.push('At least 2 poll options are required');
                result.isValid = false;
            }
            break;
        case 'getHistory':
            if (!params.chatId) {
                result.errors.push('Chat ID is required for getHistory operation');
                result.isValid = false;
            }
            if (params.limit && (typeof params.limit !== 'number' || params.limit <= 0)) {
                result.errors.push('Limit must be a positive number');
                result.isValid = false;
            }
            break;
        case 'deleteMessage':
            if (!params.chatId) {
                result.errors.push('Chat ID is required for deleteMessage operation');
                result.isValid = false;
            }
            if (!params.messageId) {
                result.errors.push('Message ID is required for deleteMessage operation');
                result.isValid = false;
            }
            break;
        case 'pinMessage':
            if (!params.chatId) {
                result.errors.push('Chat ID is required for pinMessage operation');
                result.isValid = false;
            }
            if (!params.messageId) {
                result.errors.push('Message ID is required for pinMessage operation');
                result.isValid = false;
            }
            break;
        case 'requestCode':
            if (!params.apiId) {
                result.errors.push('API ID is required for requestCode operation');
                result.isValid = false;
            }
            if (!params.apiHash) {
                result.errors.push('API Hash is required for requestCode operation');
                result.isValid = false;
            }
            if (!params.phoneNumber) {
                result.errors.push('Phone number is required for requestCode operation');
                result.isValid = false;
            }
            break;
        case 'resendCode':
            if (!params.apiId) {
                result.errors.push('API ID is required for resendCode operation');
                result.isValid = false;
            }
            if (!params.apiHash) {
                result.errors.push('API Hash is required for resendCode operation');
                result.isValid = false;
            }
            if (!params.phoneNumber) {
                result.errors.push('Phone number is required for resendCode operation');
                result.isValid = false;
            }
            if (!params.phoneCodeHash) {
                result.errors.push('Phone code hash is required for resendCode operation');
                result.isValid = false;
            }
            if (!params.preAuthSession) {
                result.errors.push('Pre-auth session is required for resendCode operation');
                result.isValid = false;
            }
            break;
        case 'requestQr':
            if (!params.apiId) {
                result.errors.push('API ID is required for requestQr operation');
                result.isValid = false;
            }
            if (!params.apiHash) {
                result.errors.push('API Hash is required for requestQr operation');
                result.isValid = false;
            }
            break;
        case 'completeQr':
            if (!params.apiId) {
                result.errors.push('API ID is required for completeQr operation');
                result.isValid = false;
            }
            if (!params.apiHash) {
                result.errors.push('API Hash is required for completeQr operation');
                result.isValid = false;
            }
            if (!params.preAuthSession) {
                result.errors.push('Pre-auth session is required for completeQr operation');
                result.isValid = false;
            }
            break;
        case 'signIn':
            if (!params.apiId) {
                result.errors.push('API ID is required for signIn operation');
                result.isValid = false;
            }
            if (!params.apiHash) {
                result.errors.push('API Hash is required for signIn operation');
                result.isValid = false;
            }
            if (!params.phoneNumber) {
                result.errors.push('Phone number is required for signIn operation');
                result.isValid = false;
            }
            if (!params.phoneCode) {
                result.errors.push('Phone code is required for signIn operation');
                result.isValid = false;
            }
            if (!params.phoneCodeHash) {
                result.errors.push('Phone code hash is required for signIn operation');
                result.isValid = false;
            }
            if (!params.preAuthSession) {
                result.errors.push('Pre-auth session is required for signIn operation');
                result.isValid = false;
            }
            break;
        case 'copyRestrictedContent':
            if (!params.sourceChatId) {
                result.errors.push('Source Chat ID is required for copyRestrictedContent operation');
                result.isValid = false;
            }
            if (!params.messageId) {
                result.errors.push('Message ID is required for copyRestrictedContent operation');
                result.isValid = false;
            }
            if (!params.saveToSavedMessages && !params.targetChatId) {
                result.errors.push('Target Chat ID is required for copyRestrictedContent operation when not saving to Saved Messages');
                result.isValid = false;
            }
            break;
        case 'getFullUser':
            if (!params.userId) {
                result.errors.push('User ID is required for getFullUser operation');
                result.isValid = false;
            }
            break;
        case 'getProfilePhoto':
            if (!params.myProfilePhotoOnly && !params.userId) {
                result.errors.push('User ID is required for getProfilePhoto operation when My Profile Photo Only is disabled');
                result.isValid = false;
            }
            break;
        case 'downloadMedia':
            if (!params.chatId) {
                result.errors.push('Chat ID is required for downloadMedia operation');
                result.isValid = false;
            }
            if (!params.messageId) {
                result.errors.push('Message ID is required for downloadMedia operation');
                result.isValid = false;
            }
            break;
        case 'getMe':
        case 'getDialogs':
            break;
        case 'updateProfile':
            break;
        case 'updateUsername':
            if (!params.newUsername) {
                result.errors.push('New username is required for updateUsername operation');
                result.isValid = false;
            }
            break;
        case 'getChat':
        case 'joinChat':
        case 'leaveChat':
        case 'joinGroup':
        case 'leaveGroup':
            if (!params.chatId) {
                result.errors.push('Chat ID is required for this operation');
                result.isValid = false;
            }
            break;
        case 'createChat':
        case 'createChannel':
            if (!params.chatTitle) {
                result.errors.push('Title is required for creating a chat/channel');
                result.isValid = false;
            }
            break;
        case 'getParticipants':
        case 'getMembers':
            if (!params.channelId) {
                result.errors.push('Channel ID is required for this operation');
                result.isValid = false;
            }
            break;
        case 'addMember':
            if (!params.channelId) {
                result.errors.push('Channel ID is required for addMember operation');
                result.isValid = false;
            }
            if (!params.userIdToAdd) {
                result.errors.push('User ID to add is required');
                result.isValid = false;
            }
            break;
        case 'removeMember':
            if (!params.channelId) {
                result.errors.push('Channel ID is required for removeMember operation');
                result.isValid = false;
            }
            if (!params.userIdToRemove) {
                result.errors.push('User ID to remove is required');
                result.isValid = false;
            }
            break;
        case 'banUser':
            if (!params.channelId) {
                result.errors.push('Channel ID is required for banUser operation');
                result.isValid = false;
            }
            if (!params.userIdToBan) {
                result.errors.push('User ID to ban is required');
                result.isValid = false;
            }
            break;
        case 'unbanUser':
            if (!params.channelId) {
                result.errors.push('Channel ID is required for unbanUser operation');
                result.isValid = false;
            }
            if (!params.userIdToUnban) {
                result.errors.push('User ID to unban is required');
                result.isValid = false;
            }
            break;
        case 'promoteUser':
            if (!params.channelId) {
                result.errors.push('Channel ID is required for promoteUser operation');
                result.isValid = false;
            }
            if (!params.userIdToPromote) {
                result.errors.push('User ID to promote is required');
                result.isValid = false;
            }
            break;
        default:
            result.warnings.push(`No specific validation defined for operation: ${operation}`);
    }
    return result;
}
function validateAll(apiId, apiHash, session, phoneNumber, operation, params) {
    const apiValidator = exports.CommonValidators.validateApiCredentials(apiId, apiHash);
    const sessionResult = validateSessionString(session);
    const phoneResult = validatePhoneNumber(phoneNumber);
    const operationResult = validateOperationParams(operation, params);
    return {
        isValid: apiValidator.isValid() &&
            sessionResult.isValid &&
            phoneResult.isValid &&
            operationResult.isValid,
        errors: [
            ...apiValidator.getErrors().map((err) => err.message),
            ...sessionResult.errors,
            ...phoneResult.errors,
            ...operationResult.errors,
        ],
        warnings: [
            ...apiValidator.getWarnings(),
            ...sessionResult.warnings,
            ...phoneResult.warnings,
            ...operationResult.warnings,
        ],
    };
}
//# sourceMappingURL=validation.js.map