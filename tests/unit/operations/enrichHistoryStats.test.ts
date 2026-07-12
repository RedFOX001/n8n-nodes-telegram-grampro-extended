import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enrichHistoryStats } from '../../../nodes/TelegramGramPro/resources/message.operations';
import type { TelegramClientInstance, TelegramEntity, HistoryStatsFields } from '../../../nodes/TelegramGramPro/core/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../nodes/TelegramGramPro/core/rateLimiter', () => ({
	withRateLimit: <T>(fn: () => Promise<T>): Promise<T> => fn(),
}));

vi.mock('../../../nodes/TelegramGramPro/core/floodWaitHandler', () => ({
	safeExecute: <T>(fn: () => Promise<T>): Promise<T> => fn(),
}));

vi.mock('../../../nodes/TelegramGramPro/core/logger', () => ({
	logger: {
		warn: vi.fn(),
		info: vi.fn(),
		error: vi.fn(),
	},
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockChannelEntity(): TelegramEntity {
	return {
		id: '12345',
		accessHash: '67890',
		className: 'Channel',
	} as unknown as TelegramEntity;
}

function createMockChatEntity(): TelegramEntity {
	return {
		id: '67890',
		className: 'Chat',
	} as unknown as TelegramEntity;
}

function createMockClient(overrides?: {
	viewsResult?: unknown;
	messagesResult?: unknown;
}): TelegramClientInstance {
	return {
		invoke: vi.fn().mockImplementation(async (_call: unknown) => {
			const callName = (_call as unknown as { className?: string }).className
				?? (_call as unknown as { _?: string })._
				?? 'UnknownCall';

			if (callName === 'messages.GetMessagesViews') {
				return overrides?.viewsResult ?? {
					views: [
						{ views: 100, forwards: 10, replies: { replies: 5, comments: true } },
						{ views: 200, forwards: 20, replies: { replies: 10, comments: false } },
						{ views: 300, forwards: 30, replies: { replies: 15, comments: true } },
					],
				};
			}

			if (callName === 'channels.GetMessages' || callName === 'messages.GetMessages') {
				return overrides?.messagesResult ?? {
					messages: [
						{
							id: 1,
							reactions: {
								results: [
									{ reaction: { emoticon: '👍' }, count: 210 },
									{ reaction: { emoticon: '🔥' }, count: 45 },
								],
							},
						},
						{
							id: 2,
							reactions: {
								results: [
									{ reaction: { emoticon: '❤️' }, count: 99 },
								],
							},
						},
						{
							id: 3,
							// No reactions — old post
						},
					],
				};
			}

			return {};
		}),
		connect: vi.fn(),
		disconnect: vi.fn(),
	} as unknown as TelegramClientInstance;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('enrichHistoryStats()', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// ── Edge Case 2: Empty page → no batch calls ─────────────────────
	it('returns immediately when messageIds is empty (no batch calls)', async () => {
		const client = createMockClient();
		const statsMap = new Map<number, HistoryStatsFields>();

		await enrichHistoryStats(
			client, 'mockPeer', createMockChannelEntity(),
			[], false, statsMap,
		);

		expect(client.invoke).not.toHaveBeenCalled();
		expect(statsMap.size).toBe(0);
	});

	// ── Normal views mapping ──────────────────────────────────────────
	it('maps views/forwards/replies/hasComments from GetMessagesViews', async () => {
		const client = createMockClient();
		const statsMap = new Map<number, HistoryStatsFields>();

		await enrichHistoryStats(
			client, 'mockPeer', createMockChannelEntity(),
			[1, 2, 3], false, statsMap,
		);

		expect(statsMap.get(1)).toEqual({
			views: 100, forwards: 10, repliesCount: 5, hasComments: true,
		});
		expect(statsMap.get(2)).toEqual({
			views: 200, forwards: 20, repliesCount: 10, hasComments: false,
		});
		expect(statsMap.get(3)).toEqual({
			views: 300, forwards: 30, repliesCount: 15, hasComments: true,
		});
	});

	// ── Reactions mapping (channel) ───────────────────────────────────
	it('maps reactions from channels.GetMessages for channel peers', async () => {
		const client = createMockClient();
		const statsMap = new Map<number, HistoryStatsFields>();

		await enrichHistoryStats(
			client, { channelId: '123', accessHash: '456' } as never,
			createMockChannelEntity(),
			[1, 2, 3], true, statsMap,
		);

		expect(statsMap.get(1)?.reactions).toEqual([
			{ emoji: '👍', count: 210 },
			{ emoji: '🔥', count: 45 },
		]);
		expect(statsMap.get(2)?.reactions).toEqual([
			{ emoji: '❤️', count: 99 },
		]);
		// Post 3 had no reactions → []
		expect(statsMap.get(3)?.reactions).toEqual([]);
	});

	// ── Reactions mapping (non-channel) ───────────────────────────────
	it('maps reactions from messages.GetMessages for non-channel peers', async () => {
		const client = createMockClient();
		const statsMap = new Map<number, HistoryStatsFields>();

		await enrichHistoryStats(
			client, 'mockPeer',
			createMockChatEntity(), // className === 'Chat'
			[1, 2], true, statsMap,
		);

		// views should still be set
		expect(statsMap.get(1)).toBeDefined();
		expect(statsMap.get(1)?.views).toBe(100);
		expect(statsMap.get(1)?.reactions).toEqual([
			{ emoji: '👍', count: 210 },
			{ emoji: '🔥', count: 45 },
		]);
	});

	// ── Edge Case 3: No reactions → empty array ───────────────────────
	it('sets reactions to [] when reactions.results is empty', async () => {
		const client = createMockClient({
			messagesResult: {
				messages: [{ id: 1 }], // no reactions.results at all
			},
		});
		const statsMap = new Map<number, HistoryStatsFields>();

		await enrichHistoryStats(
			client, 'mockPeer', createMockChannelEntity(),
			[1], true, statsMap,
		);

		expect(statsMap.get(1)?.reactions).toEqual([]);
	});

	// ── Edge Case 4: Old post without replies → nulls ────────────────
	it('sets repliesCount null and hasComments false when replies missing', async () => {
		const client = createMockClient({
			viewsResult: {
				views: [
					{ views: 50, forwards: 5 }, // no replies field
				],
			},
		});
		const statsMap = new Map<number, HistoryStatsFields>();

		await enrichHistoryStats(
			client, 'mockPeer', createMockChannelEntity(),
			[1], false, statsMap,
		);

		expect(statsMap.get(1)).toEqual({
			views: 50, forwards: 5, repliesCount: null, hasComments: false,
		});
	});

	// ── Edge Case 5: MessageEmpty skipped ─────────────────────────────
	it('skips MessageEmpty entries in reactions batch', async () => {
		const client = createMockClient({
			messagesResult: {
				messages: [
					{ id: 1, reactions: { results: [{ reaction: { emoticon: '👍' }, count: 10 }] } },
					{ className: 'MessageEmpty', _: 'MessageEmpty' },
					{ id: 3, reactions: { results: [] } },
				],
			},
		});
		const statsMap = new Map<number, HistoryStatsFields>();

		await enrichHistoryStats(
			client, 'mockPeer', createMockChannelEntity(),
			[1, 2, 3], true, statsMap,
		);

		// MessageEmpty for ID 2 should not overwrite existing stats
		expect(statsMap.get(1)?.reactions).toEqual([{ emoji: '👍', count: 10 }]);
		// ID 2 was empty → existing views remain
		expect(statsMap.get(2)?.views).toBe(200);
	});

	// ── Edge Case 6: GetMessagesViews failure → graceful nulls ───────
	it('defaults to nulls when GetMessagesViews throws', async () => {
		const failingClient = createMockClient({
			viewsResult: Promise.reject(new Error('FLOOD_WAIT')),
		} as never);
		// Override invoke to reject for views
		(failingClient as { invoke: unknown }).invoke = vi.fn().mockRejectedValue(
			new Error('FLOOD_WAIT'),
		);
		// But resolve for messages
		(failingClient as { invoke: unknown }).invoke = vi.fn()
			.mockRejectedValueOnce(new Error('FLOOD_WAIT'))
			.mockResolvedValueOnce({ messages: [{ id: 1 }] });

		const statsMap = new Map<number, HistoryStatsFields>();

		await enrichHistoryStats(
			failingClient, 'mockPeer', createMockChannelEntity(),
			[1], false, statsMap,
		);

		// Views should be nulls
		expect(statsMap.get(1)).toEqual({
			views: null, forwards: null, repliesCount: null, hasComments: false,
		});
	});

	// ── Edge Case 8: Chunking >100 posts ──────────────────────────────
	it('chunks >100 IDs and calls invoke twice', async () => {
		const ids = Array.from({ length: 150 }, (_, i) => i + 1);
		const viewsForChunk = Array.from({ length: 100 }, (_, i) => ({
			views: i, forwards: 0, replies: { replies: 0, comments: false },
		}));
		const viewsForChunk2 = Array.from({ length: 50 }, (_, i) => ({
			views: i, forwards: 0, replies: { replies: 0, comments: false },
		}));

		const client = createMockClient({
			viewsResult: viewsForChunk,
		} as never);
		let callCount = 0;
		(client as { invoke: unknown }).invoke = vi.fn().mockImplementation(() => {
			callCount++;
			if (callCount === 1) return { views: viewsForChunk };
			if (callCount === 2) return { views: viewsForChunk2 };
			return { messages: [] };
		});

		const statsMap = new Map<number, HistoryStatsFields>();

		await enrichHistoryStats(
			client, 'mockPeer', createMockChannelEntity(),
			ids, false, statsMap,
		);

		// Should have at least 2 views calls (100 + 50 = 2 chunks)
		expect(client.invoke).toHaveBeenCalledTimes(2);
		expect(statsMap.size).toBe(150);
		expect(statsMap.get(1)?.views).toBe(0);
		expect(statsMap.get(150)?.views).toBe(49); // index 49 in second chunk
	});

	// ── Views length mismatch guard ───────────────────────────────────
	it('defaults chunk to nulls when views length differs from idChunk', async () => {
		const client = createMockClient({
			viewsResult: { views: [{ views: 999 }] }, // only 1 item for 3 IDs
		} as never);
		(client as { invoke: unknown }).invoke = vi.fn().mockResolvedValue({
			views: [{ views: 999 }],
		});

		const statsMap = new Map<number, HistoryStatsFields>();

		await enrichHistoryStats(
			client, 'mockPeer', createMockChannelEntity(),
			[1, 2, 3], false, statsMap,
		);

		// All should be null because length mismatch was detected
		expect(statsMap.get(1)).toEqual({
			views: null, forwards: null, repliesCount: null, hasComments: false,
		});
		expect(statsMap.get(2)).toEqual({
			views: null, forwards: null, repliesCount: null, hasComments: false,
		});
		expect(statsMap.get(3)).toEqual({
			views: null, forwards: null, repliesCount: null, hasComments: false,
		});
	});
});
