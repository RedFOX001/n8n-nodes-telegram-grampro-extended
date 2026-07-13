import { IExecuteFunctions, INodeExecutionData, type IDataObject } from 'n8n-workflow';
import type { TelegramClientInstance } from './types';
export declare function chunk<T>(items: T[], size: number): T[][];
export declare abstract class BaseOperation {
    protected client: TelegramClientInstance;
    protected context: IExecuteFunctions;
    protected operation: string;
    constructor(context: IExecuteFunctions, operation: string);
    protected initializeClient(): Promise<void>;
    protected executeWithRateLimit<T>(fn: () => Promise<T>): Promise<T>;
    protected getParameter<T>(name: string, index?: number): T;
    protected getStringParameter(name: string, index?: number): string;
    protected getNumberParameter(name: string, index?: number): number;
    protected getBooleanParameter(name: string, index?: number): boolean;
    protected getArrayParameter<T>(name: string, index?: number): T[];
    protected validateParameters(): Promise<void>;
    protected abstract execute(): Promise<INodeExecutionData[]>;
    run(): Promise<INodeExecutionData[]>;
}
export declare class ParameterExtractor {
    static extractMessageParams(context: IExecuteFunctions, index?: number): {
        chatId: string;
        text: string;
        messageId: number;
        replyTo: number;
        noWebpage: boolean;
        silent: boolean;
    };
    static extractChatParams(context: IExecuteFunctions, index?: number): {
        chatId: string;
        title: string;
        about: string;
        users: string[];
    };
    static extractUserParams(context: IExecuteFunctions, index?: number): {
        userId: string;
        username: string;
        firstName: string;
        lastName: string;
        bio: string;
    };
    static extractMediaParams(context: IExecuteFunctions, index?: number): {
        chatId: string;
        messageId: number;
        media: unknown;
        caption: string;
    };
}
export declare class ResponseFormatter {
    static success(data: IDataObject, metadata?: IDataObject): INodeExecutionData[];
    static error(message: string, error?: unknown): INodeExecutionData[];
    static messageResult(message: IDataObject): INodeExecutionData[];
    static userResult(user: IDataObject): INodeExecutionData[];
    static chatResult(chat: IDataObject): INodeExecutionData[];
}
