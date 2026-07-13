"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaRouter = mediaRouter;
const clientManager_1 = require("../core/clientManager");
const floodWaitHandler_1 = require("../core/floodWaitHandler");
const teleproto_1 = require("teleproto");
const payloadBuilders_1 = require("../core/payloadBuilders");
async function mediaRouter(operation, i) {
    const creds = (await this.getCredentials('telegramGramProApi'));
    const client = await (0, clientManager_1.getClient)(creds.apiId, creds.apiHash, creds.session);
    switch (operation) {
        case 'downloadMedia':
            return downloadMedia.call(this, client, i);
        default:
            throw new Error(`Media operation not supported: ${operation}`);
    }
}
async function downloadMedia(client, i) {
    var _a, _b;
    const chatIdInput = this.getNodeParameter('chatId', i);
    const messageIdInput = Number(this.getNodeParameter('messageId', i));
    const entity = await client.getEntity(chatIdInput);
    const messages = (await (0, floodWaitHandler_1.safeExecute)(() => client.getMessages(entity, { ids: [messageIdInput] })));
    const msg = messages === null || messages === void 0 ? void 0 : messages[0];
    if (!msg || msg instanceof teleproto_1.Api.MessageEmpty) {
        throw new Error('Message not found or contains no media');
    }
    const chatEntity = entity;
    let albumMessages = [msg];
    const gid = (_a = msg.groupedId) === null || _a === void 0 ? void 0 : _a.toString();
    if (gid) {
        const surrounding = (await (0, floodWaitHandler_1.safeExecute)(() => client.getMessages(entity, {
            limit: 20,
            offsetId: messageIdInput + 10,
        })));
        albumMessages = surrounding.filter((m) => { var _a; return ((_a = m.groupedId) === null || _a === void 0 ? void 0 : _a.toString()) === gid; });
        albumMessages.sort((a, b) => a.id - b.id);
        if (!albumMessages.find((m) => m.id === msg.id)) {
            albumMessages = [msg];
        }
    }
    const senderEntity = (await ((_b = msg.getSender) === null || _b === void 0 ? void 0 : _b.call(msg)));
    const messageContext = (0, payloadBuilders_1.resolveMessageContextFromEntities)(msg, chatEntity, senderEntity);
    const payload = gid
        ? (0, payloadBuilders_1.buildSharedAlbumPayload)(albumMessages, messageContext)
        : (0, payloadBuilders_1.buildSharedMessagePayload)(msg, messageContext);
    const item = await (0, payloadBuilders_1.createSharedBinaryExecutionItem)(this, albumMessages, payload, false);
    return [item];
}
//# sourceMappingURL=media.operations.js.map