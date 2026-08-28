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
    markers.push({ tag, color, open: `[${tag}[`, close: `]${tag}]` });
  }

  // Longest tag first, so a short tag (e.g. "o") can't swallow the prefix of
  // a longer one (e.g. "oz") when both are configured at once.
  markers.sort((a, b) => b.open.length - a.open.length);

  cachedMarkers = markers;
  return markers;
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
      const emptyAttr = isEmpty
        ? ` data-empty-text="${openMatch.open}  ${openMatch.close}"`
        : '';

      const token = state.push('html_inline', '', 0);
      token.content = `<span class="${cls}" style="${style}"${emptyAttr}>`;
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
  md.core.ruler.push('marker_zones', (state) => {
    const markers = getMarkers();
    if (!markers.length) return;

    const tokens = state.tokens;
    let active = null; // the marker whose zone is currently open, or null

    const tagBlock = (token) => {
      token.attrJoin('class', 'marker-zone');
      const style = markerStyle(active.color);
      const existing = token.attrGet('style');
      token.attrSet('style', existing ? `${existing};${style}` : style);
    };

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      // Tag every top-level block that opens while a zone is active. The
      // opener's own block is tagged below, when the marker is found.
      if (active && token.nesting === 1) tagBlock(token);

      if (token.type !== 'inline' || !token.children) continue;

      let opensHere = false;
      let closesHere = false;

      for (const child of token.children) {
        if (child.type !== 'text' || !child.content) continue;

        if (!active) {
          for (const m of markers) {
            if (child.content.includes(m.open)) {
              child.content = child.content.split(m.open).join('');
              active = m;
              opensHere = true;
              break;
            }
          }
        }

        if (active && child.content.includes(active.close)) {
          child.content = child.content.split(active.close).join('');
          closesHere = true;
        }
      }

      // Retro-tag the block that contains the opening marker: its
      // `*_open` token was emitted before we knew a zone started.
      // (Only on open: a continuation or closing block already got tagged
      // by the `active` branch above.)
      if (opensHere && i > 0) {
        for (let j = i - 1; j >= 0; j--) {
          if (tokens[j].nesting === 1) {
            tagBlock(tokens[j]);
            break;
          }
        }
      }

      if (closesHere) active = null;
    }
  });
}

exports.activate = () => {
  try {
    const vscode = require('vscode');
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('markerHighlight.markers')) invalidateMarkerCache();
    });
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
