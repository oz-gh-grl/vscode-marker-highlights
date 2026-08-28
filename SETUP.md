# Getting started with Marker Highlights

This is a small VS Code add-on. It colors reviewer comments written in
Markdown files — like `[gandalf[ looks good to me ]gandalf]` — so it's easy to
tell people's comments apart from the document itself, and from each other.
It works both in the normal editing view and in VS Code's preview pane.

## 1. Get the code

Ask whoever shared this with you for the repo link, then clone it:

```powershell
git clone https://github.com/oz-gh-grl/vscode-marker-highlights.git
cd vscode-marker-highlights
```

## 2. Build and install the extension

You'll need [Node.js](https://nodejs.org) installed (if you already use VS
Code for development, you probably have it). Then, from inside the folder
you just cloned:

```powershell
npx --yes @vscode/vsce package
code --install-extension marker-highlights-3.0.0.vsix
```

The first command builds an installable package; the second installs it into
your VS Code. Then reload VS Code (Command Palette → type "Developer: Reload
Window" → Enter).

## 3. Set up your own markers

This is the one-time setup that makes the extension actually useful — telling
it who you are and what color you want.

Open your VS Code **user settings** as a file: Command Palette → type
"Preferences: Open User Settings (JSON)" → Enter. Add this block anywhere in
the file (or merge it in if you already have a `markerHighlight.markers`
entry):

```json
"markerHighlight.markers": [
  { "tag": "gandalf", "color": "#B2EC5D", "label": "Gandalf" },
  { "tag": "claude", "color": "#f0a558", "label": "Claude" }
]
```

Replace `"gandalf"` with your own handle — your first name or initials work
well. Keep it short, one word, no spaces or brackets.

- Your own marker: suggested color **Inchworm green**, `#B2EC5D`.
- Claude's marker: suggested color **orange**, `#f0a558` — this is the color
  the extension already uses as its default, so sticking with it keeps
  Claude's comments looking the same across everyone's setup.

Everyone on the team can use their own handle and their own color — as long
as each tag is unique, they'll all show up distinctly, in both views, at the
same time.

Save the file. No reload needed — the source editor picks up the change
within about a second, and the preview picks it up the next time it renders.

## 4. Using it

Wrap a comment in your tag, opened and closed the same way on both ends:

```markdown
[gandalf[ this section needs another pass before we ship it ]gandalf]
```

That's it — it'll show up colored (with your label, if you set one) in both
the raw Markdown and the preview pane, and disappears from the preview's
rendered output cleanly (the preview strips the brackets; the raw source
keeps them, since that's the actual text of the file).

## Later: changing your color, or adding another tag

Just edit the same `markerHighlight.markers` block in your user settings —
add another `{ "tag": ..., "color": ..., "label": ... }` entry, or change an
existing one's color. No reinstall needed.
