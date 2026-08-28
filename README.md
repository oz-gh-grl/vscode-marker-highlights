# Marker Highlights

Highlights `[tag[ ... ]tag]` regions in the VS Code Markdown **preview**, where
the tag and its color are configurable — so any number of reviewers can each
get their own marker and color in the same document.

## The convention

A reviewer answers inline, in the same file, wrapping their reply in an
asymmetric marker like `[comment[ ... ]comment]`. The markers won't collide
with real Markdown, so they stay greppable and are trivial to strip
programmatically.

Several Claude Code skills lean on this convention — most notably
`/extensive-feedback`, which runs a multi-round, file-based Q&A: Claude writes
numbered questions into a scratch document, and the reviewer answers
underneath each one inside `[tag[ ... ]tag]` markers. The same pattern shows
up in ad-hoc review passes over plans and drafts.

Rendered as plain Markdown those replies look exactly like the surrounding
body text, which is precisely when you need to tell them apart. This
extension colors them — a different color per tag, so several reviewers'
replies in the same document stay visually distinct.

## Configuration

Set `markerHighlight.markers` in your VS Code settings (user or workspace)
to a list of `{ tag, color }` pairs:

```json
"markerHighlight.markers": [
  { "tag": "comment", "color": "#f0a558" },
  { "tag": "steve", "color": "#4caf50" },
  { "tag": "ben", "color": "#8e44ad" }
]
```

Every tag listed is active at once — `[steve[ ... ]steve]` and
`[ben[ ... ]ben]` can appear in the same document, each in its own color. If
the setting is left unset, it defaults to a single `comment` tag in orange.

Add an optional `label` to a marker to show attribution as a prefix (e.g.
`Steve: `) at the start of each note and at the opening block of each zone —
not repeated on every block a zone spans:

```json
"markerHighlight.markers": [
  { "tag": "comment", "color": "#f0a558", "label": "Comment" },
  { "tag": "steve", "color": "#4caf50", "label": "Steve" }
]
```

Leave `label` off a tag to keep it color-only, as before.

Changing the setting takes effect on the next preview render (edit the
document, or use the preview pane's refresh button) — no window reload
needed.

## What it does

| Usage | Renders as |
|---|---|
| Open and close in the same paragraph | inline `<span class="marker-note">`, colored text |
| Open and close in different blocks | every block between them gets `marker-zone` — colored text plus a left rule |

Markdown inside the markers still parses normally (emphasis, code spans,
links), and the markers themselves are stripped from the output. A marker
inside a code span or fenced block is left alone.

Markers of different tags can nest — e.g. a `[steve[ ... ]steve]` aside
inside a still-open `[comment[ ... ]comment]` zone — and each keeps its own
color. When a block is covered by more than one open zone at once, it shows
the innermost one's color.

## Install

```powershell
npx --yes @vscode/vsce package
code --install-extension marker-highlights-2.2.0.vsix
```

Or, for a no-build install, copy this folder to
`%USERPROFILE%\.vscode\extensions\marker-highlights-2.2.0\` and reload the
window.

## Companion: highlighting in the editor

This extension only affects the **preview**. To get the same markers colored
in the Markdown **source**, install `fabiospampinato.vscode-highlight` and
adapt the regex rule documented in `editor-highlight-settings.jsonc` to your
configured tags.

## Credits

Written by David E. Osorio.
