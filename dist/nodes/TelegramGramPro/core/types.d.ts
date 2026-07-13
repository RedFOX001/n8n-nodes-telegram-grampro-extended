import type { IDataObject, LogMetadata } from 'n8n-workflow';
import { Api, TelegramClient } from 'teleproto';
import type { EntityLike, FileLike } from 'teleproto/define';
import type { NewMessage, NewMessageEvent } from 'teleproto/events';
export interface TelegramCredentials extends IDataObject {
    apiId: number | string;
    apiHash: string;
    session: string;
    phoneNumber?: string;
}
export type TelegramEntity = Api.User | Api.UserEmpty | Api.Chat | Api.ChatEmpty | Api.Channel | Api.ChannelForbidden;
export type TelegramMessageLike = Api.Message | Api.MessageService;
export type TelegramMediaLike = Api.TypeMessageMedia | undefined;
export type TelegramClientInstance = TelegramClient;
export type TelegramEntityLike = EntityLike;
export type TelegramFileLike = FileLike;
export type TelegramJsonObject = IDataObject;
export type TelegramUnknownRecord = Record<string, unknown>;
export type TelegramLoggerContext = LogMetadata | Error | TelegramUnknownRecord | undefined;
export interface TelegramTriggerPayload extends IDataObject {
    updateType?: 'message' | 'edited_message' | 'deleted_message' | 'user_update';
    groupedId?: string;
    mediaCount?: number;
    message?: string;
    rawMessage?: string;
    date?: string | null;
    editDate?: string | null;
    chatName?: string | null;
    chatId?: string | null;
    chatType?: TelegramTriggerChatType;
    senderName?: string | null;
    senderId?: string | null;
    senderIsBot?: boolean | null;
    messageId?: string;
    userId?: string;
    user?: IDataObject;
    status?: IDataObject;
    action?: IDataObject;
    isPrivate?: boolean;
    isGroup?: boolean;
    isChannel?: boolean;
    isOutgoing?: boolean;
    messageType?: 'text' | 'photo' | 'video' | 'document' | 'other';
    hasMedia?: boolean;
    disableBinary?: boolean;
    fileName?: string;
    fileExtension?: string;
    mimeType?: string;
    size?: string;
    bytes?: number;
    binaryBase64?: string;
    mediaFiles?: IDataObject[];
    hasWebPreview?: boolean;
    mediaDownloadError?: string;
    raw?: IDataObject;
}
export type TelegramTriggerChatType = 'user' | 'bot' | 'group' | 'supergroup' | 'channel' | 'unknown';
export interface TelegramTriggerHandlerRegistration {
    handler: (event: NewMessageEvent) => Promise<void>;
    event: NewMessage;
}
export interface TelegramMessage {
    id: number;
    text: string;
    date: Date | number;
    fromId?: string;
    chatId?: string;
    replyToId?: number;
    isOutgoing: boolean;
    direction: 'sent' | 'received';
    hasMedia?: boolean;
    hasWebPreview?: boolean;
    mediaType?: string;
}
export interface TelegramChat {
    id: string;
    title?: string;
    username?: string;
    type: 'user' | 'chat' | 'channel';
    participantsCount?: number;
    isCreator?: boolean;
    isPublic?: boolean;
}
export interface TelegramUser {
    id: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    isBot?: boolean;
    isVerified?: boolean;
    isScam?: boolean;
    bio?: string;
    commonChatsCount?: number;
}
export interface TelegramMedia {
    id: string;
    type: 'photo' | 'video' | 'document' | 'audio' | 'sticker';
    fileName?: string;
    mimeType?: string;
    size?: string;
    bytes?: number;
    width?: number;
    height?: number;
    duration?: number;
}
export interface ChannelParticipant {
    userId: string;
    role: 'creator' | 'admin' | 'member';
    isAdmin: boolean;
    isCreator: boolean;
    inviterId?: string;
    invitedAt?: Date;
}
export interface TelegramPoll {
    id: string;
    question: string;
    options: string[];
    isQuiz: boolean;
    isAnonymous: boolean;
    correctAnswerIndex?: number;
    totalVoters?: number;
}
export interface TelegramSession {
    sessionString: string;
    apiId: number;
    apiHash: string;
    phoneNumber?: string;
    isEncrypted: boolean;
}
export interface TelegramError {
    code: string;
    message: string;
    retryable: boolean;
    retryAfter?: number;
    retryAfterSeconds?: number;
}
export interface TelegramClientConfig {
    apiId: number;
    apiHash: string;
    session: string;
    connectionRetries?: number;
    autoReconnect?: boolean;
    connectTimeout?: number;
}
export interface OperationResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: TelegramError;
    metadata?: {
        timestamp: Date;
        operation: string;
        chatId?: string;
        messageId?: number;
    };
}
export interface SendMessageOptions {
    chatId: string;
    text: string;
    replyTo?: number;
    noWebpage?: boolean;
    silent?: boolean;
    scheduleDate?: Date;
}
export interface EditMessageOptions {
    chatId: string;
    messageId: number;
    text: string;
    noWebpage?: boolean;
}
export interface EditMessageMediaOptions {
    chatId: string;
    messageId: number;
    media: Api.TypeInputMedia | TelegramFileLike;
    caption?: string;
    captionEntities?: Api.TypeMessageEntity[];
}
export interface DeleteMessageOptions {
    chatId: string;
    messageId: number;
    revoke: boolean;
}
export interface PinMessageOptions {
    chatId: string;
    messageId: number;
    notify: boolean;
}
export interface CreatePollOptions {
    chatId: string;
    question: string;
    options: string[];
    isQuiz: boolean;
    isAnonymous: boolean;
    correctAnswerIndex?: number;
}
export interface CreateChatOptions {
    title: string;
    about?: string;
    users: string[];
}
export interface CreateChannelOptions {
    title: string;
    about?: string;
    isBroadcast?: boolean;
    isPublic?: boolean;
    username?: string;
}
export interface UserLookupOptions {
    userId: string;
    includeFullInfo?: boolean;
}
export interface HistoryOptions {
    chatId: string;
    limit: number;
    offset?: number;
    minId?: number;
    maxId?: number;
}
export interface ParticipantsOptions {
    channelId: string;
    limit: number;
    offset?: number;
    filter?: 'admins' | 'kicked' | 'banned' | 'recent' | 'search';
    query?: string;
}
export interface MessageReactionSummary {
    emoji: string;
    count: number;
}
export interface HistoryStatsFields {
    views: number | null;
    forwards: number | null;
    repliesCount: number | null;
    hasComments: boolean;
    reactions?: MessageReactionSummary[];
}
