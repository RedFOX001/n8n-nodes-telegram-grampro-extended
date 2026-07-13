"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderTelegramEntities = renderTelegramEntities;
exports.prepareTelegramTextInput = prepareTelegramTextInput;
const html_1 = require("teleproto/extensions/html");
const SUPPORTED_HTML_TAG_PATTERN = /<(a|b|strong|i|em|u|s|strike|del|code|pre|spoiler|blockquote|tg-emoji)\b/i;
const MARKDOWNISH_PATTERN = /!\[[^\]]*]\(tg:\/\/emoji\?id=\d+\)|\[[^\]]+]\([^)]+\)|\*\*[\s\S]+?\*\*|~~[\s\S]+?~~|```[\s\S]+?```|`[^`\n]+`|__[\s\S]+?__|\|\|[\s\S]+?\|\||(^|[^\w])_[^_\n]+_($|[^\w])/m;
function renderTelegramEntities(text, entities) {
    if (!text || !Array.isArray(entities) || entities.length === 0) {
        return text;
    }
    const htmlRendered = convertTelegramHtmlToMarkdown(html_1.HTMLParser.unparse(text, entities));
    if (htmlRendered !== text) {
        return htmlRendered;
    }
    return renderTelegramEntitiesFallback(text, entities.filter((entity) => typeof entity === 'object' && entity !== null));
}
function prepareTelegramTextInput(text) {
    if (!text) {
        return { text };
    }
    if (!MARKDOWNISH_PATTERN.test(text) && !SUPPORTED_HTML_TAG_PATTERN.test(text)) {
        return { text };
    }
    if (SUPPORTED_HTML_TAG_PATTERN.test(text) && !MARKDOWNISH_PATTERN.test(text)) {
        return { text, parseMode: 'html' };
    }
    let html = text;
    html = html.replace(/!\[([^\]]*)]\(tg:\/\/emoji\?id=(\d+)\)/g, '<tg-emoji emoji-id="$2">$1</tg-emoji>');
    html = html.replace(/```([^\n`]*)\n?([\s\S]*?)```/g, (_match, language, code) => {
        const trimmedLanguage = language.trim();
        return trimmedLanguage
            ? `<pre><code class="language-${trimmedLanguage}">${code}</code></pre>`
            : `<pre>${code}</pre>`;
    });
    html = html.replace(/\[([^\]]+)]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
    html = html.replace(/\|\|([\s\S]+?)\|\|/g, '<spoiler>$1</spoiler>');
    html = html.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/~~([\s\S]+?)~~/g, '<del>$1</del>');
    html = html.replace(/__([\s\S]+?)__/g, '<em>$1</em>');
    html = html.replace(/(^|[^\w])_([^_\n]+)_($|[^\w])/gm, '$1<em>$2</em>$3');
    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    return { text: html, parseMode: 'html' };
}
function convertTelegramHtmlToMarkdown(html) {
    return html
        .replace(/<pre><code class="language-([^"]+)">([\s\S]*?)<\/code><\/pre>/g, (_match, language, code) => `\`\`\`${language}\n${code}\`\`\``)
        .replace(/<pre>([\s\S]*?)<\/pre>/g, (_match, code) => `\`\`\`${code}\`\`\``)
        .replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, (_match, content) => content
        .split('\n')
        .map((line) => (line.length > 0 ? `> ${line}` : '>'))
        .join('\n'))
        .replace(/<strong>([\s\S]*?)<\/strong>/g, '**$1**')
        .replace(/<em>([\s\S]*?)<\/em>/g, '_$1_')
        .replace(/<del>([\s\S]*?)<\/del>/g, '~~$1~~')
        .replace(/<code>([\s\S]*?)<\/code>/g, '`$1`')
        .replace(/<u>([\s\S]*?)<\/u>/g, '<u>$1</u>')
        .replace(/<spoiler>([\s\S]*?)<\/spoiler>/g, '||$1||')
        .replace(/<a href="([^"]+)">([\s\S]*?)<\/a>/g, '[$2]($1)')
        .replace(/<tg-emoji emoji-id="([^"]+)">([\s\S]*?)<\/tg-emoji>/g, '![$2](tg://emoji?id=$1)');
}
function renderTelegramEntitiesFallback(text, entities) {
    var _a, _b;
    const replacements = [];
    for (const entity of entities) {
        const start = (_a = entity.offset) !== null && _a !== void 0 ? _a : 0;
        const length = (_b = entity.length) !== null && _b !== void 0 ? _b : 0;
        const end = start + length;
        if (start < 0 || length <= 0 || end > text.length) {
            continue;
        }
        const entityText = text.slice(start, end);
        const rendered = renderEntityText(entity, entityText);
        if (rendered !== entityText) {
            replacements.push({ start, end, value: rendered });
        }
    }
    if (replacements.length === 0) {
        return text;
    }
    replacements.sort((a, b) => {
        if (a.start !== b.start) {
            return b.start - a.start;
        }
        return b.end - a.end;
    });
    let result = text;
    let lastAppliedStart = Number.MAX_SAFE_INTEGER;
    for (const replacement of replacements) {
        if (replacement.end > lastAppliedStart) {
            continue;
        }
        result = result.slice(0, replacement.start) + replacement.value + result.slice(replacement.end);
        lastAppliedStart = replacement.start;
    }
    return result;
}
function renderEntityText(entity, entityText) {
    var _a, _b, _c, _d;
    const entityType = (_b = (_a = entity.className) !== null && _a !== void 0 ? _a : entity._) !== null && _b !== void 0 ? _b : '';
    switch (entityType) {
        case 'MessageEntityTextUrl':
        case 'messageEntityTextUrl':
            return entity.url ? `[${entityText}](${entity.url})` : entityText;
        case 'MessageEntityUrl':
        case 'messageEntityUrl':
            return `[${entityText}](${entityText})`;
        case 'MessageEntityEmail':
        case 'messageEntityEmail':
            return `[${entityText}](mailto:${entityText})`;
        case 'MessageEntityPhone':
        case 'messageEntityPhone':
            return `[${entityText}](tel:${entityText})`;
        case 'MessageEntityBold':
        case 'messageEntityBold':
            return `**${entityText}**`;
        case 'MessageEntityItalic':
        case 'messageEntityItalic':
            return `_${entityText}_`;
        case 'MessageEntityStrike':
        case 'messageEntityStrike':
            return `~~${entityText}~~`;
        case 'MessageEntityUnderline':
        case 'messageEntityUnderline':
            return `<u>${entityText}</u>`;
        case 'MessageEntitySpoiler':
        case 'messageEntitySpoiler':
            return `||${entityText}||`;
        case 'MessageEntityCode':
        case 'messageEntityCode':
            return `\`${entityText}\``;
        case 'MessageEntityPre':
        case 'messageEntityPre':
            return `\`\`\`${entity.language ? entity.language + '\n' : ''}${entityText}\`\`\``;
        case 'MessageEntityBlockquote':
        case 'messageEntityBlockquote':
            return entityText
                .split('\n')
                .map((line) => (line.length > 0 ? `> ${line}` : '>'))
                .join('\n');
        case 'MessageEntityMentionName':
        case 'messageEntityMentionName':
        case 'InputMessageEntityMentionName':
        case 'inputMessageEntityMentionName': {
            const userId = toIdString((_c = entity.userId) !== null && _c !== void 0 ? _c : entity.user_id);
            return userId ? `[${entityText}](tg://user?id=${userId})` : entityText;
        }
        case 'MessageEntityCustomEmoji':
        case 'messageEntityCustomEmoji': {
            const documentId = toIdString((_d = entity.documentId) !== null && _d !== void 0 ? _d : entity.document_id);
            return documentId ? `![${entityText}](tg://emoji?id=${documentId})` : entityText;
        }
        default:
            return entityText;
    }
}
function toIdString(value) {
    if (value === undefined) {
        return undefined;
    }
    return value.toString();
}
//# sourceMappingURL=messageFormatting.js.map