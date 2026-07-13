import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import type { TelegramClientInstance, TelegramEntity, HistoryStatsFields } from '../core/types';
export declare function messageRouter(this: IExecuteFunctions, operation: string, i: number): Promise<INodeExecutionData[]>;
export declare function resolvePeer(client: TelegramClientInstance, rawId: unknown): Promise<unknown>;
export declare function enrichHistoryStats(client: TelegramClientInstance, peer: unknown, chatEntity: TelegramEntity, messageIds: number[], includeReactions: boolean, statsByMessageId: Map<number, HistoryStatsFields>): Promise<void>;
