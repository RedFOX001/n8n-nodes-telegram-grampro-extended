<div align="center">

![Telegram GramPro Extended Banner](docs/assets/n8n-nodes-telegram-grampro.webp)

# 🚀 Telegram GramPro Extended for n8n

> **Fork** of [n8n-nodes-telegram-grampro](https://github.com/sadiakant/n8n-nodes-telegram-grampro) (upstream) with **extended post statistics** in `getHistory`.
>
> Published as `n8n-nodes-telegram-grampro-extended` — use both the original node and this fork side by side.

<div align="left">

---

## ✅ Release 1 — What's implemented

### Extended Post Statistics in `getHistory`

The core addition of this fork: a new `Include Stats` boolean parameter on the **Get Chat History** operation that enriches each returned message with **views, forwards, replies count, has-comments flag, and reactions** — using batch MTProto calls (max 2 extra calls per page).

| Field | Type | Description |
|---|---|---|
| `views` | `number \| null` | Total post views |
| `forwards` | `number \| null` | Total forwards count |
| `repliesCount` | `number \| null` | Number of replies (comments thread) |
| `hasComments` | `boolean` | Whether the post has a linked comment thread |
| `reactions` | `Array<{emoji, count}> \| undefined` | Per-post reaction counts |

**Key design decisions:**

- `includeStats: false` (default) — behaviour is **identical** to the upstream node, zero changes
- Batch-first: `messages.getMessagesViews` + `channels.getMessages`/`messages.getMessages` — one call per chunk of 100 IDs
- Reuses the existing core infrastructure (`rateLimiter`, `floodWaitHandler`, `operationHelpers`) — no duplicate retry stack
- Defensive: errors per chunk → `logger.warn` + `null`/`[]` defaults, never breaks the full history response
- `discussionChatId` is **excluded** from Release 1 (will be added in Release 2 along with full discussion analytics)

### Installation

```bash
# n8n Community Nodes (recommended)
n8n settings → Community Nodes → Add "n8n-nodes-telegram-grampro-extended"

# Or clone & build manually
git clone https://github.com/RedFOX001/n8n-nodes-telegram-grampro-extended.git
cd n8n-nodes-telegram-grampro-extended
npm install
npm run build
```

### Quick Setup

1. Get API credentials at [my.telegram.org](https://my.telegram.org)
2. Create a session string using the built-in Auth operations (see [Authorization Guide](./docs/AUTHORIZATION_GUIDE.md))
3. In n8n → Settings → Credentials → Telegram GramPro Extended → fill API ID, API Hash, Session String

---

## 🔮 Roadmap — Release 2 (planned)

1. `getDiscussionInfo` — debug helper for channel-to-discussion group resolution
2. `getPostComments` — read comments via `getDiscussionMessage` + `getReplies`
3. `getPostStats` — standalone operation for targeted per-ID stats requests
4. Deep-thread replies / recursive comments (v2)
5. `discussionChatId` field in getHistory output

---

## 📦 Upstream features (present in both upstream and this fork)

For the full feature set inherited from the upstream project (send/edit/delete/pin/forward messages, polls, media, user/channel management, triggers, chat actions, etc.), see the [Operations Guide](./docs/OPERATIONS_GUIDE.md) and the original [README](https://github.com/sadiakant/n8n-nodes-telegram-grampro#readme).

---

## Project Structure

```
n8n-nodes-telegram-grampro-extended/
├── package.json
├── tsconfig.json
├── nodes/
│   ├── TelegramGramPro/
│   │   ├── TelegramGramPro.node.ts
│   │   ├── core/
│   │   │   ├── operationHelpers.ts        # chunk() for batch splitting
│   │   │   ├── types.ts                   # HistoryStatsFields + existing types
│   │   │   └── ...
│   │   └── resources/
│   │       ├── message.operations.ts      # getHistory with includeStats logic
│   │       └── ...
│   └── TelegramGramProTrigger/
└── credentials/
```

---

## 🔗 Resources

- **Fork repository:** [RedFOX001/n8n-nodes-telegram-grampro-extended](https://github.com/RedFOX001/n8n-nodes-telegram-grampro-extended)
- **Upstream:** [sadiakant/n8n-nodes-telegram-grampro](https://github.com/sadiakant/n8n-nodes-telegram-grampro)
- **NPM:** `n8n-nodes-telegram-grampro-extended`
- [Operations Guide](./docs/OPERATIONS_GUIDE.md)
- [Authorization Guide](./docs/AUTHORIZATION_GUIDE.md)
- [Troubleshooting Guide](./docs/TROUBLESHOOTING_GUIDE.md)
- [Change Log](./docs/CHANGE_LOG.md)

## 📄 License

[MIT License](./LICENSE) — see LICENSE file for details.

---

*Built on top of [Telegram GramPro](https://github.com/sadiakant/n8n-nodes-telegram-grampro) by Krushnakant Sadiya, with ❤️ for n8n automation workflows*
