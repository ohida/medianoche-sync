/**
 * ⚓️ Context Anchor (🤖 AI Instructions)
 *
 * Medianoche Sync - Obsidian Plugin
 *
 * This plugin supports the reading workflow on iPad and Desktop.
 * It manipulates the Frontmatter of Markdown files exported from Medianoche,
 * providing Star / Archive / Delete actions.
 *
 * FRONTMATTER SCHEMA STRATEGY:
 * - We follow Obsidian Web Clipper standards for content interpretation:
 *   - `source` (URL of the article)
 *   - `description` (AI Summary or meta description)
 *   - `created` (Creation date)
 * - We use a dedicated `medianoche_` namespace for system control to avoid collisions:
 *   - `medianoche_id` (SSOT ID)
 *   - `medianoche_starred`
 *   - `medianoche_archived`
 *   - `medianoche_deleted`
 *   - `medianoche_score`
 *   - `medianoche_cluster`
 * - Exception: `og_image` is used instead of `medianoche_og_image` for broader compatibility.
 *
 * UI:
 * - Reading View: Action Bar at the bottom of the note (Post Processor)
 * - Live Preview / Source: Header Icons (dynamically added)
 *
 * Hotkeys:
 * - Cmd+Shift+S: Toggle Star
 * - Cmd+Shift+A: Toggle Archive
 * - Cmd+Shift+D: Toggle Delete
 */

import {
	Plugin,
	Notice,
	TFile,
	TFolder,
	MarkdownView,
	MarkdownPostProcessorContext,
	Modal,
	App,
} from 'obsidian';

// ============================================================
// Constants
// ============================================================

// const PROCESSED_FOLDER = '_processed';

// ============================================================
// Types
// ============================================================

interface MedianocheMetadata {
	medianocheId: number | null;
	starred: boolean;
	archived: boolean;
	deleted: boolean;
}

// ============================================================
// Main Plugin Class
// ============================================================

export default class MedianocheSyncPlugin extends Plugin {
	// ヘッダーアクション用のアイコン要素（削除時に使用）
	private headerActions: HTMLElement[] = [];

	async onload() {
		console.log('Loading Medianoche Sync plugin');

		// コマンド登録
		this.registerCommands();

		// Reading View: 本文下アクションバー
		this.registerMarkdownPostProcessor(
			(el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
				this.addActionBar(el, ctx);
			}
		);

		// Live Preview / Source: ヘッダーアイコン
		this.registerEvent(
			this.app.workspace.on('file-open', (file) => {
				this.updateHeaderActions(file);
			})
		);

		// メタデータ変更時にヘッダーアイコンを更新
		this.registerEvent(
			this.app.metadataCache.on('changed', (file) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile && file.path === activeFile.path) {
					this.updateHeaderActions(activeFile);
				}
			})
		);

		// 初期表示
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile) {
			this.updateHeaderActions(activeFile);
		}
	}

	onunload() {
		console.log('Unloading Medianoche Sync plugin');
		this.clearHeaderActions();
	}

	// ============================================================
	// Command Registration
	// ============================================================

	private registerCommands() {
		// Star トグル
		this.addCommand({
			id: 'toggle-star',
			name: 'Toggle Star',
			callback: () => this.toggleStarCurrentFile(),
			hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 's' }],
		});

		// Archive
		this.addCommand({
			id: 'archive',
			name: 'Toggle Archive',
			callback: () => this.archiveCurrentFile(),
			hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'a' }],
		});

		// Delete
		this.addCommand({
			id: 'delete',
			name: 'Toggle Delete',
			callback: () => this.deleteCurrentFile(),
			hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'd' }],
		});
	}

	// ============================================================
	// Action Handlers (Current File)
	// ============================================================

	private async toggleStarCurrentFile() {
		const file = this.app.workspace.getActiveFile();
		if (!file) {
			new Notice('No active file');
			return;
		}
		await this.toggleStar(file);
	}

	private async archiveCurrentFile() {
		const file = this.app.workspace.getActiveFile();
		if (!file) {
			new Notice('No active file');
			return;
		}
		await this.toggleArchive(file);
	}

	private async deleteCurrentFile() {
		const file = this.app.workspace.getActiveFile();
		if (!file) {
			new Notice('No active file');
			return;
		}
		await this.toggleDelete(file);
	}

	// ============================================================
	// Core Actions
	// ============================================================

	async toggleStar(file: TFile): Promise<boolean | null> {
		if (!this.isMedianocheFile(file)) {
			new Notice('Not a Medianoche file');
			return null;
		}

		const meta = await this.getMedianocheMetadata(file);
		const newValue = !meta.starred;
		await this.updateFrontmatter(file, 'medianoche_starred', newValue);
		new Notice(newValue ? '⭐ Starred!' : '☆ Unstarred');
		return newValue;
	}
	async toggleArchive(file: TFile): Promise<boolean | null> {
		if (!this.isMedianocheFile(file)) {
			new Notice('Not a Medianoche file');
			return null;
		}

		const meta = await this.getMedianocheMetadata(file);
		const newValue = !meta.archived;
		await this.updateFrontmatter(file, 'medianoche_archived', newValue);
		new Notice(newValue ? '📦 Archived' : '📦 Unarchived');
		return newValue;
	}

	async toggleDelete(file: TFile): Promise<boolean | null> {
		if (!this.isMedianocheFile(file)) {
			new Notice('Not a Medianoche file');
			return null;
		}

		const meta = await this.getMedianocheMetadata(file);
		const newValue = !meta.deleted;

		if (newValue) {
			// 確認ダイアログ（モバイルでも動作）
			const confirmed = await this.confirmDelete(file.basename);
			if (!confirmed) {
				return null; // Cancelled
			}
		}

		await this.updateFrontmatter(file, 'medianoche_deleted', newValue);
		new Notice(newValue ? '🗑️ Marked for deletion' : '♻️ Restored');
		return newValue;
	}

	// ============================================================
	// Frontmatter Utilities
	// ============================================================

	isMedianocheFile(file: TFile): boolean {
		const cache = this.app.metadataCache.getFileCache(file);
		const frontmatter = cache?.frontmatter;
		return frontmatter?.medianoche_id != null;
	}

	async getMedianocheMetadata(file: TFile): Promise<MedianocheMetadata> {
		const cache = this.app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter ?? {};
		return {
			medianocheId: fm.medianoche_id ?? null,
			starred: fm.medianoche_starred === true,
			archived: fm.medianoche_archived === true,
			deleted: fm.medianoche_deleted === true,
		};
	}

	async updateFrontmatter(
		file: TFile,
		key: string,
		value: boolean
	): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			fm[key] = value;
		});
	}

	// ============================================================
	// Confirmation Dialog
	// ============================================================

	private async confirmDelete(filename: string): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new ConfirmDeleteModal(this.app, filename, resolve);
			modal.open();
		});
	}

	// ============================================================
	// Reading View: Action Bar (Post Processor)
	// ============================================================

	private addActionBar(el: HTMLElement, ctx: MarkdownPostProcessorContext) {
		// ソースファイルを取得
		const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
		if (!(file instanceof TFile)) return;
		if (!this.isMedianocheFile(file)) return;


		// 最後のセクションにのみ追加（重複防止）
		const info = ctx.getSectionInfo(el);
		if (!info) return;

		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache) return;

		const sections = cache.sections ?? [];
		const lastSection = sections[sections.length - 1];
		if (!lastSection) return;

		if (info.lineEnd !== lastSection.position.end.line) return;

		// アクションバーを作成
		this.createActionBarElement(el, file);
	}

	private async createActionBarElement(container: HTMLElement, file: TFile) {
		const meta = await this.getMedianocheMetadata(file);

		const actionBar = container.createDiv({ cls: 'medianoche-action-bar' });

		// Star ボタン
		const starBtn = actionBar.createEl('button', {
			cls: `medianoche-action-button ${meta.starred ? 'starred' : ''}`,
			text: meta.starred ? '⭐ Starred' : '☆ Star',
		});
		starBtn.addEventListener('click', async () => {
			const newState = await this.toggleStar(file);
			if (newState === null) return;
			// ボタン状態を更新 (メタデータ再取得ではなく、結果を使用)
			starBtn.textContent = newState ? '⭐ Starred' : '☆ Star';
			starBtn.toggleClass('starred', newState);
		});

		// Archive ボタン
		const archiveBtn = actionBar.createEl('button', {
			cls: `medianoche-action-button ${meta.archived ? 'archived' : ''}`,
			text: meta.archived ? '📦 Archived' : '📦 Archive',
		});
		archiveBtn.addEventListener('click', async () => {
			const newState = await this.toggleArchive(file);
			if (newState === null) return;

			// Update button state
			archiveBtn.textContent = newState ? '📦 Archived' : '📦 Archive';
			archiveBtn.toggleClass('archived', newState);
		});

		// Delete ボタン
		const deleteBtn = actionBar.createEl('button', {
			cls: `medianoche-action-button delete ${meta.deleted ? 'deleted' : ''}`,
			text: meta.deleted ? '🗑️ Deleted' : '🗑️ Delete',
		});
		deleteBtn.addEventListener('click', async () => {
			const newState = await this.toggleDelete(file);

			// キャンセル時(null)は更新しない
			if (newState === null) return;

			deleteBtn.textContent = newState ? '🗑️ Deleted' : '🗑️ Delete';
			deleteBtn.toggleClass('deleted', newState);
		});
	}

	// ============================================================
	// Live Preview / Source: Header Actions
	// ============================================================

	private async updateHeaderActions(file: TFile | null) {
		this.clearHeaderActions();

		if (!file || !this.isMedianocheFile(file)) return;

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		// 状態を取得してアイコンを動的に設定
		const meta = await this.getMedianocheMetadata(file);

		// Delete アイコン
		const deleteAction = view.addAction('trash', 'Delete', () => this.toggleDelete(file));
		if (meta.deleted) {
			deleteAction.addClass('medianoche-deleted');
		}
		this.headerActions.push(deleteAction);

		// Archive アイコン
		const archiveAction = view.addAction('archive', 'Archive', () => this.toggleArchive(file));
		if (meta.archived) {
			archiveAction.addClass('medianoche-archived');
		}
		this.headerActions.push(archiveAction);

		// Star アイコン（状態に応じて CSS クラスで色を変更）
		const starLabel = meta.starred ? 'Unstar' : 'Star';
		const starAction = view.addAction('star', starLabel, () =>
			this.toggleStar(file)
		);
		if (meta.starred) {
			starAction.addClass('medianoche-starred');
		}
		this.headerActions.push(starAction);
	}

	private clearHeaderActions() {
		this.headerActions.forEach((el) => el.remove());
		this.headerActions = [];
	}
}

// ============================================================
// Confirm Delete Modal
// ============================================================


class ConfirmDeleteModal extends Modal {
	private filename: string;
	private onConfirm: (confirmed: boolean) => void;

	constructor(
		app: App,
		filename: string,
		onConfirm: (confirmed: boolean) => void
	) {
		super(app);
		this.filename = filename;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: 'Delete Confirmation' });
		contentEl.createEl('p', {
			text: `Are you sure you want to delete "${this.filename}"?`,
		});
		contentEl.createEl('p', {
			text: 'This will mark the item for deletion in Medianoche.',
			cls: 'mod-warning',
		});

		const buttonContainer = contentEl.createDiv({
			cls: 'medianoche-modal-buttons',
		});

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel',
		});
		cancelBtn.addEventListener('click', () => {
			this.onConfirm(false);
			this.close();
		});

		const confirmBtn = buttonContainer.createEl('button', {
			text: 'Delete',
			cls: 'mod-warning',
		});
		confirmBtn.addEventListener('click', () => {
			this.onConfirm(true);
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
