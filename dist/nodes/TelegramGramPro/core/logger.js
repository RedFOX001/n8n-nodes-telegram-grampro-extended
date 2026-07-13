"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const levelMap = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};
function isLogLevel(value) {
    return value in levelMap;
}
function resolveLogLevel() {
    var _a, _b, _c;
    const configuredLevel = (_b = (_a = process.env.GRAMPRO_LOG_LEVEL) === null || _a === void 0 ? void 0 : _a.toLowerCase()) !== null && _b !== void 0 ? _b : (_c = process.env.N8N_LOG_LEVEL) === null || _c === void 0 ? void 0 : _c.toLowerCase();
    if (configuredLevel && isLogLevel(configuredLevel)) {
        return configuredLevel;
    }
    return 'warn';
}
function isMetadataRecord(value) {
    return typeof value === 'object' && value !== null;
}
function normalizeContext(context) {
    if (!context) {
        return undefined;
    }
    if (context instanceof Error) {
        return {
            errorName: context.name,
            errorMessage: context.message,
            stack: context.stack,
        };
    }
    if (isMetadataRecord(context)) {
        return context;
    }
    return undefined;
}
function log(level, message, context) {
    if (!shouldLog(level))
        return;
    const timestampedMessage = `[${level.toUpperCase()}] ${new Date().toISOString()} - ${message}`;
    const metadata = normalizeContext(context);
    if (metadata) {
        n8n_workflow_1.LoggerProxy[level](timestampedMessage, metadata);
        return;
    }
    n8n_workflow_1.LoggerProxy[level](timestampedMessage);
}
const resolvedLevel = resolveLogLevel();
const currentLevel = levelMap[resolvedLevel];
function shouldLog(level) {
    return levelMap[level] <= currentLevel;
}
exports.logger = {
    info: (message, context) => {
        log('info', message, context);
    },
    warn: (message, context) => {
        log('warn', message, context);
    },
    error: (message, context) => {
        log('error', message, context);
    },
    debug: (message, context) => {
        log('debug', message, context);
    },
};
//# sourceMappingURL=logger.js.map