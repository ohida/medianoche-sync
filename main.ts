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
 *   - `medianoche_cluster_label`
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
	MarkdownView,
	MarkdownPostProcessorContext,
	Modal,
	App,
	PluginSettingTab,
	Setting,
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

interface MedianocheSyncSettings {
	confirmBeforeDelete: boolean;
	showReadingActionBar: boolean;
	showEditorHeaderActions: boolean;
}

type MedianocheBooleanKey =
	| 'medianoche_starred'
	| 'medianoche_archived'
	| 'medianoche_deleted';

const DEFAULT_SETTINGS: MedianocheSyncSettings = {
	confirmBeforeDelete: true,
	showReadingActionBar: true,
	showEditorHeaderActions: true,
};

const HIDE_READING_ACTION_BAR_CLASS = 'medianoche-hide-reading-action-bar';

// ============================================================
// Main Plugin Class
// ============================================================

export default class MedianocheSyncPlugin extends Plugin {
	// ヘッダーアクション用のアイコン要素（削除時に使用）
	private headerActions: HTMLElement[] = [];
	private headerUpdateSeq = 0;
	settings: MedianocheSyncSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new MedianocheSyncSettingTab(this.app, this));
		this.applyVisibilitySettings();

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
		this.clearHeaderActions();
		document.body.classList.remove(HIDE_READING_ACTION_BAR_CLASS);
	}

	async loadSettings() {
		this.settings = {
			...DEFAULT_SETTINGS,
			...(await this.loadData()),
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	applyVisibilitySettings() {
		document.body.classList.toggle(
			HIDE_READING_ACTION_BAR_CLASS,
			!this.settings.showReadingActionBar
		);

		if (this.settings.showEditorHeaderActions) {
			this.updateHeaderActions(this.app.workspace.getActiveFile());
		} else {
			this.clearHeaderActions();
		}
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

		this.addCommand({
			id: 'open-settings',
			name: 'Open settings',
			callback: () => this.openSettings(),
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
			new Notice('Not a Medianoche note');
			return null;
		}

		const newValue = await this.toggleBooleanFrontmatter(
			file,
			'medianoche_starred'
		);
		if (newValue === null) {
			new Notice('Not a Medianoche note');
			return null;
		}
		new Notice(newValue ? 'Starred' : 'Unstarred');
		return newValue;
	}

	async toggleArchive(file: TFile): Promise<boolean | null> {
		if (!this.isMedianocheFile(file)) {
			new Notice('Not a Medianoche note');
			return null;
		}

		const newValue = await this.toggleBooleanFrontmatter(
			file,
			'medianoche_archived'
		);
		if (newValue === null) {
			new Notice('Not a Medianoche note');
			return null;
		}
		new Notice(
			newValue
				? 'Archived in Medianoche'
				: 'Restored to Inbox in Medianoche'
		);
		return newValue;
	}

	async toggleDelete(file: TFile): Promise<boolean | null> {
		if (!this.isMedianocheFile(file)) {
			new Notice('Not a Medianoche note');
			return null;
		}

		const meta = this.getMedianocheMetadata(file);
		const newValue = !meta.deleted;

		if (newValue && this.settings.confirmBeforeDelete) {
			// 確認ダイアログ（モバイルでも動作）
			const confirmed = await this.confirmDelete(file.basename);
			if (!confirmed) {
				return null; // Cancelled
			}
		}

		const savedValue = await this.setBooleanFrontmatter(
			file,
			'medianoche_deleted',
			newValue
		);
		if (savedValue === null) {
			new Notice('Not a Medianoche note');
			return null;
		}
		new Notice(
			savedValue
				? 'Marked for deletion in Medianoche'
				: 'Deletion mark removed'
		);
		return savedValue;
	}

	// ============================================================
	// Frontmatter Utilities
	// ============================================================

	isMedianocheFile(file: TFile): boolean {
		const cache = this.app.metadataCache.getFileCache(file);
		const frontmatter = cache?.frontmatter;
		return parseMedianocheId(frontmatter?.medianoche_id) !== null;
	}

	getMedianocheMetadata(file: TFile): MedianocheMetadata {
		const cache = this.app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter ?? {};
		return {
			medianocheId: parseMedianocheId(fm.medianoche_id),
			starred: parseMedianocheBoolean(fm.medianoche_starred),
			archived: parseMedianocheBoolean(fm.medianoche_archived),
			deleted: parseMedianocheBoolean(fm.medianoche_deleted),
		};
	}

	async toggleBooleanFrontmatter(
		file: TFile,
		key: MedianocheBooleanKey
	): Promise<boolean | null> {
		let nextValue: boolean | null = null;

		await this.app.fileManager.processFrontMatter(file, (fm) => {
			if (parseMedianocheId(fm.medianoche_id) === null) {
				return;
			}

			nextValue = !parseMedianocheBoolean(fm[key]);
			fm[key] = nextValue;
		});

		return nextValue;
	}

	async setBooleanFrontmatter(
		file: TFile,
		key: MedianocheBooleanKey,
		value: boolean
	): Promise<boolean | null> {
		let savedValue: boolean | null = null;

		await this.app.fileManager.processFrontMatter(file, (fm) => {
			if (parseMedianocheId(fm.medianoche_id) === null) {
				return;
			}

			fm[key] = value;
			savedValue = value;
		});

		return savedValue;
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

	private createActionBarElement(container: HTMLElement, file: TFile) {
		const meta = this.getMedianocheMetadata(file);

		const actionBar = container.createDiv({ cls: 'medianoche-action-bar' });

		// Star ボタン
		const starBtn = actionBar.createEl('button', {
			cls: `medianoche-action-button ${meta.starred ? 'starred' : ''}`,
			text: getStarButtonText(meta.starred),
		});
		starBtn.addEventListener('click', async () => {
			try {
				const newState = await this.toggleStar(file);
				if (newState === null) return;
				// ボタン状態を更新 (メタデータ再取得ではなく、結果を使用)
				starBtn.textContent = getStarButtonText(newState);
				starBtn.toggleClass('starred', newState);
			} catch (error) {
				console.error('Medianoche Sync: failed to toggle star', error);
				new Notice('Failed to update Medianoche frontmatter');
			}
		});

		// Archive ボタン
		const archiveBtn = actionBar.createEl('button', {
			cls: `medianoche-action-button ${meta.archived ? 'archived' : ''}`,
			text: getArchiveButtonText(meta.archived),
		});
		archiveBtn.addEventListener('click', async () => {
			try {
				const newState = await this.toggleArchive(file);
				if (newState === null) return;

				// Update button state
				archiveBtn.textContent = getArchiveButtonText(newState);
				archiveBtn.toggleClass('archived', newState);
			} catch (error) {
				console.error('Medianoche Sync: failed to toggle archive', error);
				new Notice('Failed to update Medianoche frontmatter');
			}
		});

		// Delete ボタン
		const deleteBtn = actionBar.createEl('button', {
			cls: `medianoche-action-button delete ${meta.deleted ? 'deleted' : ''}`,
			text: getDeleteButtonText(meta.deleted),
		});
		deleteBtn.addEventListener('click', async () => {
			try {
				const newState = await this.toggleDelete(file);

				// キャンセル時(null)は更新しない
				if (newState === null) return;

				deleteBtn.textContent = getDeleteButtonText(newState);
				deleteBtn.toggleClass('deleted', newState);
			} catch (error) {
				console.error('Medianoche Sync: failed to toggle delete', error);
				new Notice('Failed to update Medianoche frontmatter');
			}
		});
	}

	// ============================================================
	// Live Preview / Source: Header Actions
	// ============================================================

	updateHeaderActions(file: TFile | null) {
		const updateSeq = ++this.headerUpdateSeq;
		this.clearHeaderActions();

		if (!this.settings.showEditorHeaderActions) return;
		if (!file || !this.isMedianocheFile(file)) return;

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view || view.file?.path !== file.path) return;

		// 状態を取得してアイコンを動的に設定
		const meta = this.getMedianocheMetadata(file);
		if (updateSeq !== this.headerUpdateSeq) return;

		const runHeaderAction = async (action: () => Promise<boolean | null>) => {
			try {
				const changed = await action();
				if (
					changed !== null &&
					this.app.workspace.getActiveFile()?.path === file.path
				) {
					this.updateHeaderActions(file);
				}
			} catch (error) {
				console.error('Medianoche Sync: failed to update header action', error);
				new Notice('Failed to update Medianoche frontmatter');
			}
		};

		// Delete アイコン
		const deleteAction = view.addAction(
			'trash',
			meta.deleted ? 'Remove deletion mark' : 'Mark for deletion',
			() => runHeaderAction(() => this.toggleDelete(file))
		);
		if (meta.deleted) {
			deleteAction.addClass('medianoche-deleted');
		}
		this.headerActions.push(deleteAction);

		// Archive アイコン
		const archiveAction = view.addAction(
			'archive',
			meta.archived ? 'Restore to Inbox' : 'Archive in Medianoche',
			() => runHeaderAction(() => this.toggleArchive(file))
		);
		if (meta.archived) {
			archiveAction.addClass('medianoche-archived');
		}
		this.headerActions.push(archiveAction);

		// Star アイコン（状態に応じて CSS クラスで色を変更）
		const starLabel = meta.starred ? 'Unstar' : 'Star';
		const starAction = view.addAction('star', starLabel, () =>
			runHeaderAction(() => this.toggleStar(file))
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

	openSettings() {
		if (openPluginSettings(this.app, this.manifest.id)) return;
		new Notice('Open Obsidian Settings > Community plugins > Medianoche Sync');
	}
}

class MedianocheSyncSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: MedianocheSyncPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Medianoche Sync' });

		new Setting(containerEl)
			.setName('Confirm before deletion')
			.setDesc('Ask before setting medianoche_deleted to true.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.confirmBeforeDelete)
					.onChange(async (value) => {
						this.plugin.settings.confirmBeforeDelete = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Show bottom action buttons in Reading view')
			.setDesc('Show Star, Archive, and Delete below Medianoche notes.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showReadingActionBar)
					.onChange(async (value) => {
						this.plugin.settings.showReadingActionBar = value;
						await this.plugin.saveSettings();
						this.plugin.applyVisibilitySettings();
					})
			);

		new Setting(containerEl)
			.setName('Show editor header actions')
			.setDesc('Show Star, Archive, and Delete icons in the note header.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showEditorHeaderActions)
					.onChange(async (value) => {
						this.plugin.settings.showEditorHeaderActions = value;
						await this.plugin.saveSettings();
						this.plugin.applyVisibilitySettings();
					})
			);
	}
}

interface ObsidianSettingsApi {
	open: () => void;
	openTabById: (id: string) => void;
}

type AppWithSettings = App & {
	setting?: ObsidianSettingsApi;
};

function openPluginSettings(app: App, pluginId: string): boolean {
	const setting = (app as AppWithSettings).setting;
	if (!setting) return false;

	setting.open();
	setting.openTabById(pluginId);
	return true;
}

// ============================================================
// Confirm Delete Modal
// ============================================================

class ConfirmDeleteModal extends Modal {
	private filename: string;
	private onConfirm: (confirmed: boolean) => void;
	private resolved = false;

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
		contentEl.createEl('h2', { text: 'Mark for deletion?' });
		contentEl.createEl('p', {
			text: `Medianoche will delete "${this.filename}" on the next reverse sync.`,
		});
		contentEl.createEl('p', {
			text: 'The source note will be removed after Medianoche accepts the deletion.',
			cls: 'mod-warning',
		});

		const buttonContainer = contentEl.createDiv({
			cls: 'medianoche-modal-buttons',
		});

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel',
		});
		cancelBtn.addEventListener('click', () => this.finish(false));

		const confirmBtn = buttonContainer.createEl('button', {
			text: 'Mark for deletion',
			cls: 'mod-warning',
		});
		confirmBtn.addEventListener('click', () => this.finish(true));
	}

	onClose() {
		this.finish(false, false);
		const { contentEl } = this;
		contentEl.empty();
	}

	private finish(confirmed: boolean, shouldClose = true) {
		if (this.resolved) return;
		this.resolved = true;
		this.onConfirm(confirmed);
		if (shouldClose) {
			this.close();
		}
	}
}

function parseMedianocheId(value: unknown): number | null {
	if (typeof value === 'number' && Number.isSafeInteger(value)) {
		return value;
	}
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!/^-?\d+$/.test(trimmed)) return null;

		const parsed = Number(trimmed);
		return Number.isSafeInteger(parsed) ? parsed : null;
	}
	return null;
}

function parseMedianocheBoolean(value: unknown): boolean {
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

function getStarButtonText(starred: boolean): string {
	return starred ? 'Unstar' : 'Star';
}

function getArchiveButtonText(archived: boolean): string {
	return archived ? 'Restore' : 'Archive';
}

function getDeleteButtonText(deleted: boolean): string {
	return deleted ? 'Undo Delete' : 'Delete';
}
