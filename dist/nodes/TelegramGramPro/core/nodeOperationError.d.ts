import { IExecuteFunctions, NodeOperationError } from 'n8n-workflow';
type ErrorContext = Pick<IExecuteFunctions, 'getNode'>;
type NodeErrorOptions = {
    context?: ErrorContext;
    itemIndex?: number;
    message?: string;
};
type CreateNodeErrorOptions = Omit<NodeErrorOptions, 'message'> & {
    cause?: unknown;
};
export declare function asNodeOperationError(error: unknown, options?: NodeErrorOptions): NodeOperationError;
export declare function createNodeOperationError(message: string, options?: CreateNodeErrorOptions): NodeOperationError;
export {};
