# Oz Markers

Highlights `[oz[ ... ]oz]` regions in the VS Code Markdown **preview**.

## The convention

Oz reviews long documents by writing his replies inline, in the same file,
wrapped in `[oz[ ... ]oz]`. The markers are asymmetric and won't collide with
real Markdown, so they stay greppable and are trivial to strip
programmatically.

Several Claude Code skills lean on this convention — most notably
`/extensive-feedback`, which runs a multi-round, file-based Q&A: Claude writes
numbered questions into a scratch document, and Oz answers underneath each one
inside `[oz[ ... ]oz]` markers. The same pattern shows up in ad-hoc review
passes over plans and drafts.

Rendered as plain Markdown those replies look exactly like the surrounding body
text, which is precisely when you need to tell them apart. This extension
colors them.

## What it does

| Usage | Renders as |
|---|---|
| Open and close in the same paragraph | inline `<span class="oz-note">`, orange text |
| Open and close in different blocks | every block between them gets `oz-zone` — orange text plus a left rule |

Markdown inside the markers still parses normally (emphasis, code spans,
links), and the markers themselves are stripped from the output. A marker
inside a code span or fenced block is left alone.

## Install

```powershell
npx --yes @vscode/vsce package
code --install-extension oz-markers-1.0.0.vsix
```

Or, for a no-build install, copy this folder to
`%USERPROFILE%\.vscode\extensions\oz-markers-1.0.0\` and reload the window.

## Companion: highlighting in the editor

This extension only affects the **preview**. To get the same markers colored in
the Markdown **source**, install `fabiospampinato.vscode-highlight` and add the
regex rule documented in `editor-highlight-settings.jsonc`.
