/**
 * Pure utility functions for Medianoche Sync.
 * These have no dependency on the Obsidian API, making them easy to test.
 */

// ============================================================
// Frontmatter Parsers
// ============================================================

export function parseMedianocheId(value: unknown): number | null {
	if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
		return value;
	}
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!/^\d+$/.test(trimmed)) return null;

		const parsed = Number(trimmed);
		return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
	}
	return null;
}

export function parseMedianocheBoolean(value: unknown): boolean {
	if (typeof value === 'boolean') {
		return value;
	}
	if (typeof value === 'number') {
		return value === 1;
	}
	if (typeof value === 'string') {
		switch (value.trim().toLowerCase()) {
			case 'true':
			case 'yes':
			case 'on':
			case '1':
				return true;
			case 'false':
			case 'no':
			case 'off':
			case '0':
				return false;
		}
	}
	return false;
}

// ============================================================
// Button Text
// ============================================================

export function getStarButtonText(starred: boolean): string {
	return starred ? 'Unstar' : 'Star';
}

export function getArchiveButtonText(archived: boolean): string {
	return archived ? 'Restore' : 'Archive';
}

export function getDeleteButtonText(deleted: boolean): string {
	return deleted ? 'Undo Delete' : 'Delete';
}
