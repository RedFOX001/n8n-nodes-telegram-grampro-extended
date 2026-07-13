export interface TelegramErrorDetails {
    rawMessage: string;
    code: string;
    userMessage: string;
    retryAfter?: number;
    retryAfterSeconds?: number;
    retryable: boolean;
}
export declare function mapTelegramError(error: unknown): TelegramErrorDetails;
