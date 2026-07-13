import { describe, it, expect } from 'vitest';
import { chunk } from '../../../nodes/TelegramGramPro/core/operationHelpers';

describe('chunk()', () => {
	it('splits array into chunks of specified size', () => {
		const result = chunk([1, 2, 3, 4, 5], 2);
		expect(result).toEqual([[1, 2], [3, 4], [5]]);
	});

	it('returns all items in one chunk if size >= length', () => {
		const result = chunk([1, 2, 3], 10);
		expect(result).toEqual([[1, 2, 3]]);
	});

	it('handles exact division without remainder', () => {
		const result = chunk([1, 2, 3, 4], 2);
		expect(result).toEqual([
			[1, 2],
			[3, 4],
		]);
	});

	it('returns original array wrapped if size <= 0', () => {
		const result = chunk([1, 2, 3], 0);
		expect(result).toEqual([[1, 2, 3]]);
	});

	it('returns original array wrapped if negative size', () => {
		const result = chunk([1, 2], -1);
		expect(result).toEqual([[1, 2]]);
	});

	it('returns empty array for empty input', () => {
		const result = chunk([], 5);
		expect(result).toEqual([]);
	});

	it('handles single-element array', () => {
		const result = chunk([42], 1);
		expect(result).toEqual([[42]]);
	});

	it('handles chunk size of 1', () => {
		const result = chunk(['a', 'b', 'c'], 1);
		expect(result).toEqual([['a'], ['b'], ['c']]);
	});

	it('works with objects', () => {
		const input = [{ id: 1 }, { id: 2 }, { id: 3 }];
		const result = chunk(input, 2);
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual([{ id: 1 }, { id: 2 }]);
		expect(result[1]).toEqual([{ id: 3 }]);
	});

	it('produces exactly the batch size expected by Telegram API (100)', () => {
		const ids = Array.from({ length: 250 }, (_, i) => i + 1);
		const result = chunk(ids, 100);
		expect(result).toHaveLength(3);
		expect(result[0]).toHaveLength(100);
		expect(result[1]).toHaveLength(100);
		expect(result[2]).toHaveLength(50);
	});
});