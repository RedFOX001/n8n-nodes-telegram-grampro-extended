"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatBytesToHuman = formatBytesToHuman;
exports.parseFileSizeToBytes = parseFileSizeToBytes;
function formatBytesToHuman(bytes) {
    if (bytes === 0)
        return '0B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const base = 1000;
    const exponent = Math.floor(Math.log(bytes) / Math.log(base));
    const unitIndex = Math.min(exponent, units.length - 1);
    const value = bytes / Math.pow(base, unitIndex);
    const formattedValue = unitIndex === 0 ? Math.floor(value).toString() : value.toFixed(1);
    return `${formattedValue}${units[unitIndex]}`;
}
function parseFileSizeToBytes(sizeStr) {
    if (!sizeStr)
        return 0;
    const cleanStr = sizeStr.toString().trim().toUpperCase();
    const match = cleanStr.match(/([\d.]+)\s*(B|KB|MB|GB|TB)/i);
    if (!match) {
        const num = parseFloat(cleanStr);
        return isNaN(num) ? 0 : Math.floor(num);
    }
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    const multipliers = {
        B: 1,
        KB: 1000,
        MB: 1000 ** 2,
        GB: 1000 ** 3,
        TB: 1000 ** 4,
    };
    return Math.floor(value * multipliers[unit]);
}
//# sourceMappingURL=fileSizeUtils.js.map