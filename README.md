# Medianoche Sync

Medianoche Sync is the official Obsidian companion plugin for
[Medianoche](https://medianoche.app), a desktop RSS reader, web clipper, and
read later app.

It adds article triage actions to Markdown files exported by Medianoche, so you
can star, archive, or mark articles for deletion without leaving your Obsidian
vault.

## What You Can Do

- Star important RSS and web articles for later review.
- Triage web clipper-style article notes exported from Medianoche.
- Archive articles after reading to keep your Medianoche Inbox focused.
- Mark articles for deletion from Obsidian when you are done with them.
- Use commands and hotkeys for fast keyboard-first triage.
- Work in Reading view, Live Preview, Source mode, desktop, and mobile.
- Keep Medianoche AI Summary and AI Comments close to the article in Obsidian
  when those export options are enabled.

## Who This Is For

Use this plugin if you read articles in Medianoche and keep exported Markdown in
Obsidian. It fits RSS reader, web clipper, Obsidian Web Clipper-style, read
later, read-it-later, web article archive, and knowledge management workflows
where Obsidian is your long-term reading vault.

This plugin does not fetch RSS feeds or create article notes by itself.
Medianoche desktop owns feed subscriptions, article extraction, file export, and
the sync watcher that imports frontmatter changes back into the app.

## Medianoche Features in Your Vault

Medianoche is an AI-powered RSS, web clipper, and read later reader. This plugin
helps its Obsidian export feel native, especially for workflows around:

- RSS and Atom feeds
- Web clipper and Obsidian Web Clipper-style article capture
- Read later article libraries
- AI Summary and AI summaries
- AI Comments and AI Perspectives
- AI Search and semantic search
- AI Clusters, scores, tags, and rich frontmatter metadata
- Local-first reading, BYOK AI, and offline-friendly knowledge management

AI Summary, AI Comments, AI Perspectives, scores, clusters, and tags are created
or managed by Medianoche desktop, then synced into Markdown files when the
corresponding Medianoche settings are enabled.

## How It Works

1. Medianoche exports an article as a Markdown file in your Obsidian vault.
2. The exported file includes a `medianoche_id` field in YAML frontmatter.
3. Medianoche Sync detects that field and shows article actions only for that
   file.
4. When you star, archive, or delete, the plugin updates Medianoche frontmatter
   fields.
5. Medianoche desktop watches those files and syncs the status back to your
   reader database.

```yaml
---
medianoche_id: 12345
medianoche_starred: false
medianoche_archived: false
medianoche_deleted: false
---
```

Only notes with `medianoche_id` are managed. Your normal Obsidian notes are left
alone.

## Commands and Hotkeys

Medianoche Sync adds commands for the active Medianoche article:

| Action | macOS | Windows / Linux |
|--------|-------|-----------------|
| Toggle star | `Cmd + Shift + S` | `Ctrl + Shift + S` |
| Archive | `Cmd + Shift + A` | `Ctrl + Shift + A` |
| Mark for deletion | `Cmd + Shift + D` | `Ctrl + Shift + D` |

The same actions are also available as article controls in supported Obsidian
views.

## Requirements

- Medianoche desktop app with Obsidian Sync enabled
- Obsidian 1.0.0 or newer
- Markdown articles exported by Medianoche

## Installation

### From Obsidian Community Plugins

1. Open **Settings** -> **Community plugins** in Obsidian.
2. Choose **Browse**.
3. Search for `Medianoche Sync`.
4. Install and enable **Medianoche Sync**.

### Manual Installation

1. Download the latest release from
   [GitHub Releases](https://github.com/ohida/medianoche-sync/releases).
2. Create this folder in your vault:
   `.obsidian/plugins/medianoche-sync/`
3. Copy `main.js`, `manifest.json`, and `styles.css` into that folder.
4. Enable **Medianoche Sync** from Obsidian's Community plugins settings.

## Local Development

```bash
npm install
npm run dev
npm run build
```

## License

Medianoche Sync is released under the [MIT License](./LICENSE).
