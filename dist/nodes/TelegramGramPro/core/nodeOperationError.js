"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asNodeOperationError = asNodeOperationError;
exports.createNodeOperationError = createNodeOperationError;
const n8n_workflow_1 = require("n8n-workflow");
const helperNode = {
    name: 'Telegram GramPro',
    type: 'n8n-nodes-telegram-grampro.helper',
    position: [0, 0],
    parameters: {},
};
function asNodeOperationError(error, options = {}) {
    var _a, _b, _c;
    if (error instanceof n8n_workflow_1.NodeOperationError) {
        return error;
    }
    const node = (_b = (_a = options.context) === null || _a === void 0 ? void 0 : _a.getNode()) !== null && _b !== void 0 ? _b : helperNode;
    if (error instanceof Error) {
        return new n8n_workflow_1.NodeOperationError(node, error, {
            itemIndex: options.itemIndex,
            message: options.message,
        });
    }
    return new n8n_workflow_1.NodeOperationError(node, (_c = options.message) !== null && _c !== void 0 ? _c : String(error), {
        itemIndex: options.itemIndex,
    });
}
function createNodeOperationError(message, options = {}) {
    var _a;
    return asNodeOperationError((_a = options.cause) !== null && _a !== void 0 ? _a : message, {
        context: options.context,
        itemIndex: options.itemIndex,
        message,
    });
}
//# sourceMappingURL=nodeOperationError.js.map