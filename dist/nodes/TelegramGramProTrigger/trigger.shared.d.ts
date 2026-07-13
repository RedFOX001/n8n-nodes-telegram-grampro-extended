import { ITriggerFunctions, INodeExecutionData } from 'n8n-workflow';
import { Api } from 'teleproto';
import { TelegramTriggerPayload } from '../TelegramGramPro/core/types';
import { MessageContext as SharedMessageContext, SupportedUpdate } from '../TelegramGramPro/core/payloadBuilders';
export type ListeningMode = 'incoming' | 'outgoing';
export interface TriggerConfig {
    updates: SupportedUpdate[];
    listeningMode: ListeningMode[];
    disableBinary: boolean;
    allMessages: boolean;
    onlyUserMessages: boolean;
    onlyChannelMessages: boolean;
    onlyGroupMessages: boolean;
    exceptSelectedChatsOnly: boolean;
    exceptSelectedChats: string[];
    selectedChatsOnly: boolean;
    selectedChats: string[];
}
export type MessageContext = SharedMessageContext;
export { SupportedUpdate };
export declare function parseTriggerConfig(this: ITriggerFunctions): TriggerConfig;
export declare function shouldProcessMessage(message: Api.Message, messageContext: MessageContext, config: TriggerConfig): boolean;
export declare function resolveMessageContext(message: Api.Message): Promise<MessageContext>;
export declare function buildTriggerPayload(updateType: SupportedUpdate | undefined, message: Api.Message, messageContext: MessageContext): TelegramTriggerPayload;
export declare function buildAlbumTriggerPayload(updateType: SupportedUpdate | undefined, messages: Api.Message[], messageContext: MessageContext): TelegramTriggerPayload;
export declare function createExecutionItem(context: ITriggerFunctions, message: Api.Message, payload: TelegramTriggerPayload, disableBinary: boolean): Promise<INodeExecutionData>;
export declare function createAlbumExecutionItem(context: ITriggerFunctions, messages: Api.Message[], payload: TelegramTriggerPayload, disableBinary: boolean): Promise<INodeExecutionData>;
export declare function createAlbumDeduplicationKey(updateType: SupportedUpdate, messages: Api.Message[]): string;
export declare function createDedupeTracker(): {
    shouldEmit(key: string): boolean;
};
export declare function createMessageDeduplicationKey(updateType: SupportedUpdate, message: Api.Message): string;
