/**
 * Medianoche Sync adds Star, Archive, and Delete controls to Markdown notes
 * exported from Medianoche into an Obsidian vault.
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
import type { Hotkey } from 'obsidian';

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
	private headerActions: HTMLElement[] = [];
	private headerUpdateSeq = 0;
	private pendingFilePaths = new Set<string>();
	settings: MedianocheSyncSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new MedianocheSyncSettingTab(this.app, this));
		this.applyVisibilitySettings();

		this.registerCommands();

		// Reading View: bottom action bar
		this.registerMarkdownPostProcessor(
			(el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
				this.addActionBar(el, ctx);
			}
		);

		// Live Preview / Source: header icons
		this.registerEvent(
			this.app.workspace.on('file-open', (file) => {
				this.updateHeaderActions(file);
			})
		);

		// Refresh header icons when Medianoche frontmatter changes.
		this.registerEvent(
			this.app.metadataCache.on('changed', (file) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile && file.path === activeFile.path) {
					this.updateHeaderActions(activeFile);
				}
			})
		);

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
		this.registerMedianocheFileCommand({
			id: 'toggle-star',
			name: 'Toggle Star',
			hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 's' }],
			run: (file) => this.toggleStar(file),
		});

		this.registerMedianocheFileCommand({
			id: 'archive',
			name: 'Toggle Archive',
			hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'a' }],
			run: (file) => this.toggleArchive(file),
		});

		this.registerMedianocheFileCommand({
			id: 'delete',
			name: 'Toggle Delete',
			hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'd' }],
			run: (file) => this.toggleDelete(file),
		});

		this.addCommand({
			id: 'open-settings',
			name: 'Open settings',
			callback: () => this.openSettings(),
		});
	}

	private registerMedianocheFileCommand(command: {
		id: string;
		name: string;
		hotkeys?: Hotkey[];
		run: (file: TFile) => Promise<boolean | null>;
	}) {
		this.addCommand({
			id: command.id,
			name: command.name,
			hotkeys: command.hotkeys,
			checkCallback: (checking: boolean) => {
				const file = this.getActiveMedianocheFile();
				if (!file) return false;

				if (!checking) {
					void command.run(file).catch((error) => {
						console.error(
							`Medianoche Sync: failed to run command ${command.id}`,
							error
						);
						new Notice('Failed to update Medianoche frontmatter');
					});
				}
				return true;
			},
		});
	}

	private getActiveMedianocheFile(): TFile | null {
		const file = this.app.workspace.getActiveFile();
		if (!file) return null;
		return this.isMedianocheFile(file) ? file : null;
	}

	// ============================================================
	// Core Actions
	// ============================================================

	async toggleStar(file: TFile): Promise<boolean | null> {
		return this.runExclusiveFileAction(
			file,
			async () => {
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
		);
	}

	async toggleArchive(file: TFile): Promise<boolean | null> {
		return this.runExclusiveFileAction(
			file,
			async () => {
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
		);
	}

	async toggleDelete(file: TFile): Promise<boolean | null> {
		return this.runExclusiveFileAction(
			file,
			async () => {
				if (!this.isMedianocheFile(file)) {
					new Notice('Not a Medianoche note');
					return null;
				}

				const meta = this.getMedianocheMetadata(file);
				const newValue = !meta.deleted;

				if (newValue && this.settings.confirmBeforeDelete) {
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
		);
	}

	private async runExclusiveFileAction(
		file: TFile,
		action: () => Promise<boolean | null>
	): Promise<boolean | null> {
		if (this.pendingFilePaths.has(file.path)) {
			return null;
		}

		this.pendingFilePaths.add(file.path);
		try {
			return await action();
		} finally {
			this.pendingFilePaths.delete(file.path);
		}
	}

	private async runActionButton(
		button: HTMLButtonElement,
		action: () => Promise<boolean | null>,
		updateButton: (newState: boolean) => void,
		errorMessage: string
	) {
		if (button.disabled) return;

		button.disabled = true;
		try {
			const newState = await action();
			if (newState === null) return;
			updateButton(newState);
		} catch (error) {
			console.error(errorMessage, error);
			new Notice('Failed to update Medianoche frontmatter');
		} finally {
			button.disabled = false;
		}
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
		const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
		if (!(file instanceof TFile)) return;
		if (!this.isMedianocheFile(file)) return;

		// Add the action bar once, after the final rendered section.
		const info = ctx.getSectionInfo(el);
		if (!info) return;

		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache) return;

		const sections = cache.sections ?? [];
		const lastSection = sections[sections.length - 1];
		if (!lastSection) return;

		if (info.lineEnd !== lastSection.position.end.line) return;

		this.createActionBarElement(el, file);
	}

	private createActionBarElement(container: HTMLElement, file: TFile) {
		const meta = this.getMedianocheMetadata(file);

		const actionBar = container.createDiv({ cls: 'medianoche-action-bar' });

		const starBtn = actionBar.createEl('button', {
			cls: `medianoche-action-button ${meta.starred ? 'starred' : ''}`,
			text: getStarButtonText(meta.starred),
		});
		starBtn.addEventListener('click', () => {
			void this.runActionButton(
				starBtn,
				() => this.toggleStar(file),
				(newState) => {
					starBtn.textContent = getStarButtonText(newState);
					starBtn.toggleClass('starred', newState);
				},
				'Medianoche Sync: failed to toggle star'
			);
		});

		const archiveBtn = actionBar.createEl('button', {
			cls: `medianoche-action-button ${meta.archived ? 'archived' : ''}`,
			text: getArchiveButtonText(meta.archived),
		});
		archiveBtn.addEventListener('click', () => {
			void this.runActionButton(
				archiveBtn,
				() => this.toggleArchive(file),
				(newState) => {
					archiveBtn.textContent = getArchiveButtonText(newState);
					archiveBtn.toggleClass('archived', newState);
				},
				'Medianoche Sync: failed to toggle archive'
			);
		});

		const deleteBtn = actionBar.createEl('button', {
			cls: `medianoche-action-button delete ${meta.deleted ? 'deleted' : ''}`,
			text: getDeleteButtonText(meta.deleted),
		});
		deleteBtn.addEventListener('click', () => {
			void this.runActionButton(
				deleteBtn,
				() => this.toggleDelete(file),
				(newState) => {
					deleteBtn.textContent = getDeleteButtonText(newState);
					deleteBtn.toggleClass('deleted', newState);
				},
				'Medianoche Sync: failed to toggle delete'
			);
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

		const starLabel = meta.starred ? 'Unstar' : 'Star';
		const starAction = view.addAction('star', starLabel, () =>
			runHeaderAction(() => this.toggleStar(file))
		);
		if (meta.starred) {
			starAction.addClass('medianoche-starred');
		}
		this.headerActions.push(starAction);

		const archiveAction = view.addAction(
			'archive',
			meta.archived ? 'Restore to Inbox' : 'Archive in Medianoche',
			() => runHeaderAction(() => this.toggleArchive(file))
		);
		if (meta.archived) {
			archiveAction.addClass('medianoche-archived');
		}
		this.headerActions.push(archiveAction);

		const deleteAction = view.addAction(
			'trash',
			meta.deleted ? 'Remove deletion mark' : 'Mark for deletion',
			() => runHeaderAction(() => this.toggleDelete(file))
		);
		if (meta.deleted) {
			deleteAction.addClass('medianoche-deleted');
		}
		this.headerActions.push(deleteAction);
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
