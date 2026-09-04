# Marker Highlights

Highlights `[tag[ ... ]tag]` regions in both the VS Code Markdown **preview**
and the Markdown **source editor**, where the tag and its color are
configurable — so any number of reviewers can each get their own marker and
color in the same document, consistently in both views, from one config.

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
not repeated on every block a zone spans. This only affects the **preview**;
the source editor is left to wrap normally, since the attribution there is
already literal text you typed inside the marker:

```json
"markerHighlight.markers": [
  { "tag": "comment", "color": "#f0a558", "label": "Comment" },
  { "tag": "steve", "color": "#4caf50", "label": "Steve" }
]
```

Leave `label` off a tag to keep it color-only, as before.

Both views pick up a config change on their next refresh: the preview on its
next render (edit the document, or use the preview pane's refresh button),
the source editor within about 150ms of an edit. Neither needs a window
reload.

## What it does

**Preview** (rendered Markdown):

| Usage | Renders as |
|---|---|
| Open and close in the same paragraph | inline `<span class="marker-note">`, colored text |
| Open and close in different blocks | every block they cover whole gets `marker-zone` — colored text plus a left rule |
| A block they cover only partly | that stretch alone gets a `marker-note` span, as if it had been written inline |

That split matters when a reply is opened partway through a block — at the tail of a checklist bullet, say — and then runs on for several paragraphs. Only the reply is colored: the bullet's own text stays in the document's voice, and the attribution label (if the tag configures one) sits where the reply actually starts rather than in front of words the reviewer never wrote. The paragraphs that follow are covered whole, so they get the block treatment.

Markdown inside the markers still parses normally (emphasis, code spans,
links), and the markers themselves are stripped from the output. A marker
inside a code span or fenced block is left alone.

**Source editor** (raw Markdown text): the same `[tag[ ... ]tag]` text stays
literally in the document (nothing is stripped, since this is source, not
rendered output) — the brackets are dimmed and bolded, and the body between
them is colored. Applies to any open Markdown editor automatically, no
separate extension or hand-maintained regex needed.

In both views, markers of different tags can nest — e.g. a
`[steve[ ... ]steve]` aside inside a still-open `[comment[ ... ]comment]`
zone/reply — and each keeps its own color rather than inheriting the outer
one's. In the preview, if a block is covered by more than one open zone at
once, it shows the innermost one's color; in the source editor, an outer
marker's body coloring is carved around any nested marker so both colors
show fully, without overlap.

## Install

```powershell
npx --yes @vscode/vsce package
code --install-extension marker-highlights-3.1.0.vsix
```

Or, for a no-build install, copy this folder to
`%USERPROFILE%\.vscode\extensions\marker-highlights-3.1.0\` and reload the
window.

## Credits

Written by David E. Osorio.
