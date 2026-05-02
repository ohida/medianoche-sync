# Medianoche Sync

An Obsidian plugin for managing articles exported from [Medianoche](https://medianoche.app) — your AI-powered RSS reader.

Star, Archive, and Delete synced articles directly within Obsidian, with changes automatically synced back to Medianoche.

## Features

### Actions

| Action | Description |
|--------|-------------|
| ⭐ **Star** | Toggle favorite status |
| 📦 **Archive** | Archive and remove from Inbox |
| 🗑️ **Delete** | Permanently delete (with confirmation) |

### UI Integration

- **Reading View**: Action bar appears below article content
- **Live Preview / Source**: Icon buttons in the header

### Hotkeys

| Action | Shortcut |
|--------|----------|
| Toggle Star | `Cmd+Shift+S` (Mac) / `Ctrl+Shift+S` (Windows) |
| Archive | `Cmd+Shift+A` (Mac) / `Ctrl+Shift+A` (Windows) |
| Delete | `Cmd+Shift+D` (Mac) / `Ctrl+Shift+D` (Windows) |

## How It Works

1. **Medianoche** exports articles as Markdown files to your Obsidian vault
2. **This plugin** updates the YAML frontmatter when you perform actions
3. **Medianoche's File Watcher** detects changes and syncs them to the database

## Target Files

Only Markdown files with `medianoche_id` in frontmatter are recognized:

```yaml
---
medianoche_id: 12345
medianoche_starred: false
medianoche_archived: false
medianoche_deleted: false
---
```

## Installation

### Via BRAT (Recommended for Beta)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) in Obsidian
2. Open BRAT settings → "Add Beta Plugin"
3. Enter: `ohida/medianoche-sync`
4. Click "Add Plugin"
5. Enable "Medianoche Sync" in Community Plugins

### Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/ohida/medianoche-sync/releases)
2. Extract `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/medianoche-sync/` folder
3. Enable "Medianoche Sync" in Community Plugins settings

## Requirements

- [Medianoche](https://medianoche.app) desktop app with Obsidian Sync enabled
- Obsidian v1.0.0 or later

## Development

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Watch mode for development
npm run dev
```

## License

MIT
