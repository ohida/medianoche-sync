import { describe, it, expect } from 'vitest';
import {
	parseMedianocheId,
	parseMedianocheBoolean,
	getStarButtonText,
	getArchiveButtonText,
	getDeleteButtonText,
} from './utils';

// ============================================================
// parseMedianocheId
// ============================================================

describe('parseMedianocheId', () => {
	it('returns the number for a positive integer', () => {
		expect(parseMedianocheId(1)).toBe(1);
		expect(parseMedianocheId(42)).toBe(42);
		expect(parseMedianocheId(12345)).toBe(12345);
	});

	it('returns the number at the safe integer boundary', () => {
		expect(parseMedianocheId(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
	});

	it('rejects zero', () => {
		expect(parseMedianocheId(0)).toBeNull();
	});

	it('rejects negative numbers', () => {
		expect(parseMedianocheId(-1)).toBeNull();
		expect(parseMedianocheId(-100)).toBeNull();
	});

	it('rejects non-safe integers', () => {
		expect(parseMedianocheId(Number.MAX_SAFE_INTEGER + 1)).toBeNull();
	});

	it('rejects floats', () => {
		expect(parseMedianocheId(1.5)).toBeNull();
		expect(parseMedianocheId(12.5)).toBeNull();
	});

	it('parses a numeric string', () => {
		expect(parseMedianocheId('12345')).toBe(12345);
		expect(parseMedianocheId('1')).toBe(1);
	});

	it('trims whitespace from strings', () => {
		expect(parseMedianocheId(' 42 ')).toBe(42);
	});

	it('rejects string "0"', () => {
		expect(parseMedianocheId('0')).toBeNull();
	});

	it('rejects negative numeric strings', () => {
		expect(parseMedianocheId('-1')).toBeNull();
		expect(parseMedianocheId('-100')).toBeNull();
	});

	it('rejects non-numeric strings', () => {
		expect(parseMedianocheId('abc')).toBeNull();
		expect(parseMedianocheId('')).toBeNull();
		expect(parseMedianocheId('12.5')).toBeNull();
		expect(parseMedianocheId('12abc')).toBeNull();
	});

	it('rejects null, undefined, boolean, object', () => {
		expect(parseMedianocheId(null)).toBeNull();
		expect(parseMedianocheId(undefined)).toBeNull();
		expect(parseMedianocheId(true)).toBeNull();
		expect(parseMedianocheId(false)).toBeNull();
		expect(parseMedianocheId({})).toBeNull();
		expect(parseMedianocheId([])).toBeNull();
	});
});

// ============================================================
// parseMedianocheBoolean
// ============================================================

describe('parseMedianocheBoolean', () => {
	it('returns boolean values as-is', () => {
		expect(parseMedianocheBoolean(true)).toBe(true);
		expect(parseMedianocheBoolean(false)).toBe(false);
	});

	it('treats 1 as true and 0 as false', () => {
		expect(parseMedianocheBoolean(1)).toBe(true);
		expect(parseMedianocheBoolean(0)).toBe(false);
	});

	it('treats other numbers as false', () => {
		expect(parseMedianocheBoolean(2)).toBe(false);
		expect(parseMedianocheBoolean(-1)).toBe(false);
		expect(parseMedianocheBoolean(0.5)).toBe(false);
	});

	it('parses truthy string variants', () => {
		expect(parseMedianocheBoolean('true')).toBe(true);
		expect(parseMedianocheBoolean('yes')).toBe(true);
		expect(parseMedianocheBoolean('on')).toBe(true);
		expect(parseMedianocheBoolean('1')).toBe(true);
	});

	it('parses falsy string variants', () => {
		expect(parseMedianocheBoolean('false')).toBe(false);
		expect(parseMedianocheBoolean('no')).toBe(false);
		expect(parseMedianocheBoolean('off')).toBe(false);
		expect(parseMedianocheBoolean('0')).toBe(false);
	});

	it('handles case-insensitive strings', () => {
		expect(parseMedianocheBoolean('TRUE')).toBe(true);
		expect(parseMedianocheBoolean('Yes')).toBe(true);
		expect(parseMedianocheBoolean('FALSE')).toBe(false);
		expect(parseMedianocheBoolean('No')).toBe(false);
	});

	it('trims whitespace', () => {
		expect(parseMedianocheBoolean(' true ')).toBe(true);
		expect(parseMedianocheBoolean(' false ')).toBe(false);
	});

	it('returns false for unknown strings', () => {
		expect(parseMedianocheBoolean('maybe')).toBe(false);
		expect(parseMedianocheBoolean('yep')).toBe(false);
		expect(parseMedianocheBoolean('')).toBe(false);
	});

	it('returns false for null, undefined, objects', () => {
		expect(parseMedianocheBoolean(null)).toBe(false);
		expect(parseMedianocheBoolean(undefined)).toBe(false);
		expect(parseMedianocheBoolean({})).toBe(false);
		expect(parseMedianocheBoolean([])).toBe(false);
	});
});

// ============================================================
// Button Text
// ============================================================

describe('getStarButtonText', () => {
	it('returns "Unstar" when starred', () => {
		expect(getStarButtonText(true)).toBe('Unstar');
	});

	it('returns "Star" when not starred', () => {
		expect(getStarButtonText(false)).toBe('Star');
	});
});

describe('getArchiveButtonText', () => {
	it('returns "Restore" when archived', () => {
		expect(getArchiveButtonText(true)).toBe('Restore');
	});

	it('returns "Archive" when not archived', () => {
		expect(getArchiveButtonText(false)).toBe('Archive');
	});
});

describe('getDeleteButtonText', () => {
	it('returns "Undo Delete" when deleted', () => {
		expect(getDeleteButtonText(true)).toBe('Undo Delete');
	});

	it('returns "Delete" when not deleted', () => {
		expect(getDeleteButtonText(false)).toBe('Delete');
	});
});
