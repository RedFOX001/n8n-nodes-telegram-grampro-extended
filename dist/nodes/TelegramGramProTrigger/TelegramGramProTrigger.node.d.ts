import type { INodeType, INodeTypeDescription, ITriggerFunctions, ITriggerResponse } from 'n8n-workflow';
import { testTelegramApi } from '../../credentials/TelegramGramProApi.credentials';
export declare class TelegramGramProTrigger implements INodeType {
    description: INodeTypeDescription;
    methods: {
        credentialTest: {
            testTelegramApi: typeof testTelegramApi;
        };
    };
    trigger(this: ITriggerFunctions): Promise<ITriggerResponse>;
}
