"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionEncryption = void 0;
const crypto = __importStar(require("crypto"));
const sessions_1 = require("teleproto/sessions");
const nodeOperationError_1 = require("./nodeOperationError");
class SessionEncryption {
    static generateKey(password, salt) {
        const keySalt = salt || crypto.randomBytes(16);
        const key = crypto.pbkdf2Sync(password, keySalt, 100000, this.KEY_LENGTH, 'sha256');
        return { key, salt: keySalt };
    }
    static encryptSession(session, password) {
        try {
            const { key, salt } = this.generateKey(password);
            const iv = crypto.randomBytes(this.IV_LENGTH);
            const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
            let encrypted = cipher.update(session, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            const tag = cipher.getAuthTag();
            const combined = Buffer.concat([salt, iv, tag, Buffer.from(encrypted, 'hex')]);
            return `n8n:${combined.toString('base64')}`;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw (0, nodeOperationError_1.createNodeOperationError)(`Session encryption failed: ${message}`, { cause: error });
        }
    }
    static decryptSession(encryptedSession, password) {
        try {
            const targetSession = encryptedSession.startsWith('n8n:')
                ? encryptedSession.substring(4)
                : encryptedSession;
            const combined = Buffer.from(targetSession, 'base64');
            const salt = combined.subarray(0, 16);
            const iv = combined.subarray(16, 16 + this.IV_LENGTH);
            const tag = combined.subarray(16 + this.IV_LENGTH, 16 + this.IV_LENGTH + this.TAG_LENGTH);
            const encryptedData = combined.subarray(16 + this.IV_LENGTH + this.TAG_LENGTH);
            const { key } = this.generateKey(password, salt);
            const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
            decipher.setAuthTag(tag);
            const decryptedBuffer = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
            return decryptedBuffer.toString('utf8');
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw (0, nodeOperationError_1.createNodeOperationError)(`Session decryption failed: ${message}`, { cause: error });
        }
    }
    static generateSecurePassword() {
        return crypto.randomBytes(32).toString('base64');
    }
    static isEncryptedSession(session) {
        if (session.startsWith('n8n:')) {
            return true;
        }
        if (session.startsWith('1')) {
            try {
                const s = new sessions_1.StringSession(session);
                if (s.serverAddress) {
                    return false;
                }
            }
            catch {
            }
        }
        try {
            const decoded = Buffer.from(session, 'base64');
            const minEncryptedLength = 16 + 16 + 16 + 10;
            return decoded.length >= minEncryptedLength;
        }
        catch {
            return false;
        }
    }
}
exports.SessionEncryption = SessionEncryption;
SessionEncryption.ALGORITHM = 'aes-256-gcm';
SessionEncryption.KEY_LENGTH = 32;
SessionEncryption.IV_LENGTH = 16;
SessionEncryption.TAG_LENGTH = 16;
//# sourceMappingURL=sessionEncryption.js.map