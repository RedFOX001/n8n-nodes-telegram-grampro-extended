export declare class SessionEncryption {
    private static readonly ALGORITHM;
    private static readonly KEY_LENGTH;
    private static readonly IV_LENGTH;
    private static readonly TAG_LENGTH;
    private static generateKey;
    static encryptSession(session: string, password: string): string;
    static decryptSession(encryptedSession: string, password: string): string;
    static generateSecurePassword(): string;
    static isEncryptedSession(session: string): boolean;
}
