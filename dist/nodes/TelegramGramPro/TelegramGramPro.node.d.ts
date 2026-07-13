import { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { testTelegramApi } from '../../credentials/TelegramGramProApi.credentials';
export declare class TelegramGramPro implements INodeType {
    description: INodeTypeDescription;
    methods: {
        credentialTest: {
            testTelegramApi: typeof testTelegramApi;
        };
    };
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
