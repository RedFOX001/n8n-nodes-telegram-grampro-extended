import type { TelegramLoggerContext } from './types';
export declare const logger: {
    info: (message: string, context?: TelegramLoggerContext) => void;
    warn: (message: string, context?: TelegramLoggerContext) => void;
    error: (message: string, context?: TelegramLoggerContext) => void;
    debug: (message: string, context?: TelegramLoggerContext) => void;
};
