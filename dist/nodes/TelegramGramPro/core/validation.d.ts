export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}
export interface ValidationError {
    field: string;
    message: string;
    code: string;
}
type ValidationFieldType = 'string' | 'number' | 'boolean' | 'array';
type ValidationParams = Record<string, unknown>;
export declare class ValidationException extends Error {
    errors: ValidationError[];
    constructor(errors: ValidationError[], message?: string);
}
export declare class EnhancedValidator {
    private errors;
    private warnings;
    validateField(fieldName: string, value: unknown, rules?: {
        required?: boolean;
        type?: ValidationFieldType;
        minLength?: number;
        maxLength?: number;
        pattern?: RegExp;
        min?: number;
        max?: number;
        custom?: (_value: unknown) => string | null;
    }): this;
    private addError;
    addWarning(message: string): this;
    isValid(): boolean;
    getErrors(): ValidationError[];
    getWarnings(): string[];
    throwIfInvalid(): void;
    getErrorMessage(): string;
    reset(): this;
}
export declare const ValidationPatterns: {
    PHONE: RegExp;
    API_ID: RegExp;
    API_HASH: RegExp;
    USERNAME: RegExp;
    CHAT_ID: RegExp;
    MESSAGE_ID: RegExp;
    URL: RegExp;
};
export declare const CommonValidators: {
    validateApiCredentials(apiId: unknown, apiHash: unknown): EnhancedValidator;
    validatePhoneNumber(phoneNumber: unknown): EnhancedValidator;
    validateChatId(chatId: unknown): EnhancedValidator;
    validateMessageText(text: unknown): EnhancedValidator;
    validateMessageId(messageId: unknown): EnhancedValidator;
    validateUserId(userId: unknown): EnhancedValidator;
};
export declare function validateSessionString(session: unknown): ValidationResult;
export declare function validatePhoneNumber(phoneNumber: unknown): ValidationResult;
export declare function validateChatId(chatId: unknown): ValidationResult;
export declare function validateMessageText(text: unknown): ValidationResult;
export declare function validateMessageId(messageId: unknown): ValidationResult;
export declare function validateUserId(userId: unknown): ValidationResult;
export declare function validateOperationParams(operation: string, params: ValidationParams): ValidationResult;
export declare function validateAll(apiId: unknown, apiHash: unknown, session: unknown, phoneNumber: unknown, operation: string, params: ValidationParams): ValidationResult;
export {};
