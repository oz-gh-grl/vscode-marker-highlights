'use strict';

/**
 * Marker Highlights
 * =================
 *
 * Highlights `[tag[ ... ]tag]` regions in the VS Code Markdown preview, where
 * `tag` and its color are user-configured — not hardcoded — so any number of
 * reviewers can each get their own marker and color in the same document.
 *
 * WHY THIS EXISTS
 * ----------------
 * A common review pattern is answering inline, in the same file, wrapping a
 * reply in an asymmetric marker like `[comment[ ... ]comment]`. The asymmetry
 * keeps it unlikely to collide with real Markdown, so it stays greppable and
 * is trivial to strip programmatically. Several Claude Code skills lean on
 * this convention — most notably `/extensive-feedback`, which runs a
 * multi-round, file-based Q&A where Claude writes numbered questions into a
 * scratch document and the reviewer answers underneath each one inside the
 * markers. The same pattern shows up in ad-hoc review passes over plans and
 * drafts.
 *
 * Rendered as plain Markdown, those replies are indistinguishable from the
 * surrounding body text, which is exactly when you need to tell them apart.
 * This plugin colors them — one color per configured tag, so e.g. Ben's
 * `[ben[ ... ]ben]` and Steve's `[steve[ ... ]steve]` can be told apart at a
 * glance in the same document.
 *
 * CONFIGURATION
 * --------------
 * Settings key `markerHighlight.markers`, an array of `{ tag, color }`. See
 * `package.json`'s `contributes.configuration` for the default and schema.
 * Changing the setting takes effect on the next preview render (edit the
 * document, or use the preview's refresh button) — no window reload needed.
 *
 * HOW IT WORKS
 * ------------
 * Two passes, because markers get used at two different scales:
 *
 *   1. INLINE  — open and close land in the same paragraph. Handled by an
 *      inline rule that emits a `<span class="marker-note">` pair, so
 *      Markdown inside the markers (emphasis, code spans, links) still
 *      parses normally.
 *
 *   2. ZONE    — open and close are in *different* blocks, i.e. the reply
 *      runs across several paragraphs or a list. The inline rule declines
 *      those (no closing marker in its slice of source), and a core rule
 *      instead tags every block from the opener through the closer with
 *      `marker-zone`.
 *
 * The markers themselves are stripped from the output in both cases. Each
 * tag's color travels as an inline `style` attribute (CSS custom properties),
 * since the palette is only known at render time, not authoring time.
 *
 * EDITOR (SOURCE) DECORATIONS
 * ----------------------------
 * The preview only covers the rendered view. A second, independent piece
 * (see "Editor decorations" below) reads the same `markerHighlight.markers`
 * config and colors the raw `[tag[ ... ]tag]` text directly in the Markdown
 * source editor via `TextEditorDecorationType`, so both views stay in sync
 * from one config instead of needing a second, hand-maintained one (as a
 * third-party regex-highlighter extension would require).
 */

const DEFAULT_MARKERS = [{ tag: 'comment', color: '#f0a558' }];

let cachedMarkers = null;

function invalidateMarkerCache() {
  cachedMarkers = null;
}

function readConfiguredMarkers() {
  // Lazily require 'vscode' so this file still loads (and the standalone
  // test/render-check.js still runs) outside the extension host, falling
  // back to the shipped default in that case.
  try {
    const vscode = require('vscode');
    return vscode.workspace.getConfiguration('markerHighlight').get('markers');
  } catch (err) {
    return undefined;
  }
}

function getMarkers() {
  if (cachedMarkers) return cachedMarkers;

  const configured = readConfiguredMarkers();
  const source = Array.isArray(configured) && configured.length ? configured : DEFAULT_MARKERS;

  const seen = new Set();
  const markers = [];
  for (const entry of source) {
    if (!entry || typeof entry.tag !== 'string') continue;
    const tag = entry.tag.trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    const color = typeof entry.color === 'string' && entry.color.trim()
      ? entry.color.trim()
      : DEFAULT_MARKERS[0].color;
    const label = typeof entry.label === 'string' && entry.label.trim()
      ? entry.label.trim()
      : null;
    markers.push({ tag, color, label, open: `[${tag}[`, close: `]${tag}]` });
  }

  // Longest tag first, so a short tag (e.g. "o") can't swallow the prefix of
  // a longer one (e.g. "oz") when both are configured at once.
  markers.sort((a, b) => b.open.length - a.open.length);

  cachedMarkers = markers;
  return markers;
}

function escapeAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function hexAlpha(color, alphaHex) {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color + alphaHex : color;
}

// CSS custom properties, set inline per element, so the stylesheet can stay
// static while the actual color comes from configuration at render time.
function markerStyle(color) {
  const rule = hexAlpha(color, '99'); // ~60% alpha, for the zone rule/border
  const wash = hexAlpha(color, '14'); // ~8% alpha, for the zone background
  return `--marker-fg:${color};--marker-rule:${rule};--marker-wash:${wash};`;
}

function markerRules(md) {
  // ---------------------------------------------------------------------
  // Pass 1: inline spans (open + close within one block's inline source)
  // ---------------------------------------------------------------------
  md.inline.ruler.before('link', 'marker_note', (state, silent) => {
    const src = state.src;
    const pos = state.pos;

    const ch = src.charCodeAt(pos);
    if (ch !== 0x5b /* [ */ && ch !== 0x5d /* ] */) return false;

    const markers = getMarkers();

    let openMatch = null;
    for (const m of markers) {
      if (src.startsWith(m.open, pos)) { openMatch = m; break; }
    }
    let closeMatch = null;
    if (!openMatch) {
      for (const m of markers) {
        if (src.startsWith(m.close, pos)) { closeMatch = m; break; }
      }
    }
    if (!openMatch && !closeMatch) return false;

    // `silent` means markdown-it is only probing for a match (e.g. while
    // validating a link label). Claim the match but never mutate state or
    // the open/close depth counters, which would desync on backtracking.
    if (silent) {
      state.pos += (openMatch || closeMatch).open.length;
      return true;
    }

    if (openMatch) {
      // Only take this as an inline span if the closer is in the same
      // inline source. Otherwise it's a multi-block zone — leave the
      // literal text alone so the core rule below can pick it up.
      const closeAt = src.indexOf(openMatch.close, pos + openMatch.open.length);
      if (closeAt === -1) return false;

      // An empty prompt — `[tag[ ]tag]`, written by /extensive-feedback to
      // invite a dictated answer — renders as a span wrapping nothing but
      // whitespace, which is invisible in the preview. That is exactly the
      // marker you most need to see, since it's the one still awaiting a
      // reply. Flag it so the stylesheet can draw a visible placeholder.
      const inner = src.slice(pos + openMatch.open.length, closeAt);
      const isEmpty = /^\s*$/.test(inner);
      const cls = isEmpty ? 'marker-note marker-empty' : 'marker-note';
      const style = markerStyle(openMatch.color);
      // Attribution prefix (e.g. "Oz: "), only when the marker configures a
      // `label` — opt-in, since existing markers without one render exactly
      // as before. Both the empty-prompt placeholder and the label render
      // via the same ::before pseudo-element, so an empty+labeled marker
      // folds the label into the placeholder text rather than setting both
      // attributes (only one `content` can win).
      const labelPrefix = openMatch.label ? `${openMatch.label}: ` : '';
      const emptyAttr = isEmpty
        ? ` data-empty-text="${escapeAttr(labelPrefix + openMatch.open)}  ${escapeAttr(openMatch.close)}"`
        : '';
      const labelAttr = (!isEmpty && openMatch.label)
        ? ` data-label="${escapeAttr(openMatch.label)}"`
        : '';

      const token = state.push('html_inline', '', 0);
      token.content = `<span class="${cls}" style="${style}"${emptyAttr}${labelAttr}>`;
      state.markerDepth = state.markerDepth || {};
      state.markerDepth[openMatch.tag] = (state.markerDepth[openMatch.tag] || 0) + 1;
      state.pos += openMatch.open.length;
      return true;
    }

    // Closer: only consume one that an inline opener of the same tag
    // actually claimed.
    const depth = (state.markerDepth && state.markerDepth[closeMatch.tag]) || 0;
    if (!depth) return false;
    const token = state.push('html_inline', '', 0);
    token.content = '</span>';
    state.markerDepth[closeMatch.tag] = depth - 1;
    state.pos += closeMatch.close.length;
    return true;
  });

  // ---------------------------------------------------------------------
  // Pass 2: multi-block zones (open and close in different blocks)
  // ---------------------------------------------------------------------
  // Runs after the `inline` core rule, so inline tokens already have their
  // children parsed and adjacent text fragments merged.
  //
  // Zones can nest (e.g. a `steve` zone opened inside a still-open `comment`
  // zone), so the currently-open zones are tracked as a stack rather than a
  // single value. A block covered by more than one open zone is styled with
  // the innermost (most recently opened) one — same rule CSS uses for any
  // overridden custom property, and simplest to reason about visually, since
  // a block can only carry one left-rule/background at a time.
  md.core.ruler.push('marker_zones', (state) => {
    const markers = getMarkers();
    if (!markers.length) return;

    const tokens = state.tokens;
    const stack = []; // markers with a currently-open zone, innermost last

    // Idempotent: a block can get tagged twice in one pass (once as a
    // continuation of an outer zone, again after it turns out to also open
    // a nested one), so this always overwrites rather than accumulates —
    // otherwise a second call would double up the class and style string.
    // `opener` marks the one block where a zone's *opening* marker actually
    // landed, so only it gets the attribution label — not every block the
    // zone happens to span.
    const tagBlock = (token, opener) => {
      if (!stack.length) return;
      const marker = stack[stack.length - 1];
      const classes = (token.attrGet('class') || '').split(' ').filter(Boolean);
      if (!classes.includes('marker-zone')) classes.push('marker-zone');
      token.attrSet('class', classes.join(' '));
      token.attrSet('style', markerStyle(marker.color));
      // attrSet, unlike the hand-built HTML string in pass 1, goes through
      // markdown-it's own renderer escaping — do not escape again here.
      if (opener && marker.label) token.attrSet('data-label', marker.label);
    };

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      // Tag every top-level block that opens while a zone is active. The
      // opener's own block is tagged below, when the marker is found.
      if (stack.length && token.nesting === 1) tagBlock(token, false);

      if (token.type !== 'inline' || !token.children) continue;

      let opensHere = false;

      for (const child of token.children) {
        if (child.type !== 'text' || !child.content) continue;

        // A block can both open a new zone and close an outer one (or
        // several markers at once), so keep scanning until nothing more
        // matches rather than stopping at the first hit.
        let changed = true;
        while (changed) {
          changed = false;
          for (const m of markers) {
            if (child.content.includes(m.open)) {
              child.content = child.content.split(m.open).join('');
              stack.push(m);
              opensHere = true;
              changed = true;
            }
            // A close only ever matches a marker that's actually open,
            // closing the innermost matching one — proper LIFO nesting.
            const openIdx = stack.lastIndexOf(m);
            if (openIdx !== -1 && child.content.includes(m.close)) {
              child.content = child.content.split(m.close).join('');
              stack.splice(openIdx, 1);
              changed = true;
            }
          }
        }
      }

      // Retro-tag the block that contains the opening marker: its
      // `*_open` token was emitted before we knew a zone started.
      // (Only on open: a continuation or closing block already got tagged
      // by the `stack.length` branch above.)
      if (opensHere && i > 0) {
        for (let j = i - 1; j >= 0; j--) {
          if (tokens[j].nesting === 1) {
            tagBlock(tokens[j], true);
            break;
          }
        }
      }
    }
  });
}

// -------------------------------------------------------------------------
// Editor decorations (Markdown SOURCE, not the rendered preview)
// -------------------------------------------------------------------------
// No block/inline distinction here — that's a markdown-it concept, and the
// editor only sees raw text. A single regex pass per tag finds every
// [tag[ ... ]tag] occurrence (an "instance"), and each instance gets three
// decorations: the open bracket, the body, and the close bracket.

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findMarkerInstances(text, markers) {
  const instances = [];
  for (const marker of markers) {
    const re = new RegExp(`${escapeRegExp(marker.open)}([\\s\\S]*?)${escapeRegExp(marker.close)}`, 'g');
    let match;
    while ((match = re.exec(text))) {
      const openStart = match.index;
      const openEnd = openStart + marker.open.length;
      const bodyEnd = openEnd + match[1].length;
      const closeEnd = bodyEnd + marker.close.length;
      instances.push({ marker, openStart, openEnd, bodyEnd, closeEnd });
    }
  }
  return instances;
}

// A marker nested inside another tag's body shouldn't get double-colored by
// the outer marker's body decoration — carve the outer body into the
// segments not covered by any directly nested instance, so the inner one's
// own color shows through untouched (same outcome as the preview, where
// nesting is native to the DOM).
function bodySegments(instance, allInstances) {
  const nested = allInstances
    .filter((o) => o !== instance && o.openStart >= instance.openEnd && o.closeEnd <= instance.bodyEnd)
    .sort((a, b) => a.openStart - b.openStart);

  const segments = [];
  let cursor = instance.openEnd;
  for (const child of nested) {
    if (child.openStart > cursor) segments.push([cursor, child.openStart]);
    cursor = Math.max(cursor, child.closeEnd);
  }
  if (cursor < instance.bodyEnd) segments.push([cursor, instance.bodyEnd]);
  return segments;
}

// Decoration types are recreated only when the config changes (see
// invalidateDecorationTypes), not on every keystroke — disposing and
// recreating them per edit would flicker the decorations.
let decorationTypesByTag = new Map();

function invalidateDecorationTypes() {
  for (const types of decorationTypesByTag.values()) {
    types.body.dispose();
    types.punctuation.dispose();
  }
  decorationTypesByTag = new Map();
}

// No `label` decoration type here: a `before` content-text decoration
// inserts a fake glyph into the editor's layout without being real
// document text, which throws off the editor's line-wrap width
// calculation. The label is preview-only (see markerRules' labelPrefix) —
// in the source editor the attribution is already literal text the user
// typed inside the marker, so nothing needs to be synthesized here.
function getDecorationTypes(vscode, marker) {
  let types = decorationTypesByTag.get(marker.tag);
  if (types) return types;

  types = {
    body: vscode.window.createTextEditorDecorationType({
      color: marker.color
    }),
    punctuation: vscode.window.createTextEditorDecorationType({
      color: hexAlpha(marker.color, '99'),
      fontWeight: 'bold'
    })
  };
  decorationTypesByTag.set(marker.tag, types);
  return types;
}

function updateEditorDecorations(vscode, editor) {
  if (!editor || editor.document.languageId !== 'markdown') return;

  const markers = getMarkers();
  const doc = editor.document;
  const text = doc.getText();
  const instances = findMarkerInstances(text, markers);
  const range = (start, end) => new vscode.Range(doc.positionAt(start), doc.positionAt(end));

  const byTag = new Map(markers.map((m) => [m.tag, { punctuation: [], body: [] }]));

  for (const instance of instances) {
    const buckets = byTag.get(instance.marker.tag);
    buckets.punctuation.push(range(instance.openStart, instance.openEnd));
    buckets.punctuation.push(range(instance.bodyEnd, instance.closeEnd));
    for (const [start, end] of bodySegments(instance, instances)) {
      if (start < end) buckets.body.push(range(start, end));
    }
  }

  // Every configured marker gets a setDecorations call every update, even
  // with an empty range list — that's what clears stale decorations for a
  // tag that no longer appears in the (possibly just-edited) document.
  for (const marker of markers) {
    const types = getDecorationTypes(vscode, marker);
    const buckets = byTag.get(marker.tag);
    editor.setDecorations(types.punctuation, buckets.punctuation);
    editor.setDecorations(types.body, buckets.body);
  }
}

function activateEditorDecorations(vscode, context) {
  const subscribe = (disposable) => {
    if (context) context.subscriptions.push(disposable);
  };

  let debounceTimer = null;
  const scheduleUpdate = (editor) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => updateEditorDecorations(vscode, editor), 150);
  };

  const updateAllVisible = () => {
    for (const editor of vscode.window.visibleTextEditors) updateEditorDecorations(vscode, editor);
  };

  subscribe(vscode.window.onDidChangeActiveTextEditor((editor) => updateEditorDecorations(vscode, editor)));
  subscribe(vscode.workspace.onDidChangeTextDocument((e) => {
    const editor = vscode.window.visibleTextEditors.find((ed) => ed.document === e.document);
    if (editor) scheduleUpdate(editor);
  }));
  subscribe(vscode.workspace.onDidChangeConfiguration((e) => {
    if (!e.affectsConfiguration('markerHighlight.markers')) return;
    invalidateMarkerCache();
    invalidateDecorationTypes();
    updateAllVisible();
  }));

  updateAllVisible();
}

exports.activate = (context) => {
  try {
    const vscode = require('vscode');
    activateEditorDecorations(vscode, context);
  } catch (err) {
    // Running outside the extension host (e.g. the standalone
    // test/render-check.js) — nothing to subscribe to.
  }

  // VS Code calls this to hand us the preview's markdown-it instance.
  return {
    extendMarkdownIt(md) {
      return md.use(markerRules);
    }
  };
};
