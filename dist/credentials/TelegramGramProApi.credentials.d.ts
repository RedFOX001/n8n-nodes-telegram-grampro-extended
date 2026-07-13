import { ICredentialType, INodeProperties, ICredentialTestRequest, INodeCredentialTestResult, ICredentialsDecrypted, ICredentialDataDecryptedObject, IHttpRequestOptions } from 'n8n-workflow';
export declare class TelegramGramProApi implements ICredentialType {
    name: string;
    displayName: string;
    documentationUrl: string;
    icon: ICredentialType['icon'];
    properties: INodeProperties[];
    test: ICredentialTestRequest;
    authenticate: (credentials: ICredentialDataDecryptedObject, requestOptions: IHttpRequestOptions) => Promise<IHttpRequestOptions>;
}
export declare function testTelegramApi(this: unknown, credential: ICredentialsDecrypted<ICredentialDataDecryptedObject> | Record<string, unknown>): Promise<INodeCredentialTestResult>;
