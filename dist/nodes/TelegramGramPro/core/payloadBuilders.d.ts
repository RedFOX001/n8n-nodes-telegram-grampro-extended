import { Api } from 'teleproto';
import type { UserUpdateEvent } from 'teleproto/events/UserUpdate';
import type { IBinaryData, INodeExecutionData, ITriggerFunctions, IExecuteFunctions } from 'n8n-workflow';
import type { TelegramTriggerChatType, TelegramTriggerPayload, TelegramEntity } from './types';
export type SupportedUpdate = 'message' | 'edited_message' | 'deleted_message' | 'user_update';
export interface MessageContext {
    chatName: string | null;
    chatUsername: string | null;
    chatId: string | null;
    chatType: TelegramTriggerChatType;
    isPrivateChat: boolean;
    isGroupChat: boolean;
    isChannelChat: boolean;
    senderName: string | null;
    senderUsername: string | null;
    senderId: string | null;
    senderIsBot: boolean | null;
}
export type MediaPayloadEntry = {
    messageId: string;
    groupedId?: string;
    messageType?: TelegramTriggerPayload['messageType'];
    fileName?: string;
    fileExtension?: string;
    mimeType?: string;
    size?: string;
    bytes?: number;
    binaryProperty?: string;
    binaryBase64?: string;
};
export type NodeExecutionContext = ITriggerFunctions | IExecuteFunctions;
export declare function buildTriggerPayload(updateType: SupportedUpdate | undefined, message: Api.Message, messageContext: MessageContext): TelegramTriggerPayload;
export declare function buildAlbumTriggerPayload(updateType: SupportedUpdate | undefined, messages: Api.Message[], messageContext: MessageContext): TelegramTriggerPayload;
export declare function buildSharedMessagePayload(message: Api.Message, messageContext: MessageContext): TelegramTriggerPayload;
export declare function buildSharedAlbumPayload(messages: Api.Message[], messageContext: MessageContext): TelegramTriggerPayload;
export declare function buildUserUpdatePayload(event: UserUpdateEvent): Promise<TelegramTriggerPayload>;
export declare function resolveMessageContext(message: Api.Message): Promise<MessageContext>;
export declare function resolveMessageContextFromEntities(message: Api.Message, chatEntity: TelegramEntity | undefined, senderEntity?: TelegramEntity | undefined): MessageContext;
export declare function createSharedBinaryExecutionItem(context: NodeExecutionContext, messages: Api.Message[], payload: TelegramTriggerPayload, disableBinary: boolean): Promise<INodeExecutionData>;
export declare function detectMessageType(message: Api.Message): TelegramTriggerPayload['messageType'];
export declare function detectWebPreview(message: Api.Message): boolean;
export declare function downloadBinaryData(context: NodeExecutionContext, message: Api.Message, messageType: TelegramTriggerPayload['messageType']): Promise<{
    binaryData: IBinaryData;
    buffer: Buffer;
    fileName: string;
    mimeType: string;
} | null>;
export declare function toIsoDate(value: Date | number | undefined): string | null;
