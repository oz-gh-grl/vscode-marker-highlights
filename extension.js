'use strict';

/**
 * Oz Markers
 * ==========
 *
 * Highlights `[oz[ ... ]oz]` regions in the VS Code Markdown preview.
 *
 * WHY THIS EXISTS
 * ---------------
 * Oz reviews long documents by writing his replies *inline, in the same file*,
 * wrapped in `[oz[ ... ]oz]`. The markers are deliberately asymmetric and
 * unlikely to collide with real Markdown, so they stay greppable and are easy
 * to strip programmatically. Several Claude Code skills lean on this
 * convention — most notably `/extensive-feedback`, which runs a multi-round,
 * file-based Q&A where Claude writes numbered questions into a scratch
 * document and Oz answers underneath each one inside `[oz[ ... ]oz]` markers.
 * Same convention shows up in ad-hoc review passes over plans and drafts.
 *
 * Rendered as plain Markdown, those replies are indistinguishable from the
 * surrounding body text, which is exactly when you need to tell them apart.
 * This plugin colors them.
 *
 * HOW IT WORKS
 * ------------
 * Two passes, because the markers get used at two different scales:
 *
 *   1. INLINE  — open and close land in the same paragraph. Handled by an
 *      inline rule that emits a `<span class="oz-note">` pair, so Markdown
 *      inside the markers (emphasis, code spans, links) still parses normally.
 *
 *   2. ZONE    — open and close are in *different* blocks, i.e. the reply runs
 *      across several paragraphs or a list. The inline rule declines those
 *      (no closing marker in its slice of source), and a core rule instead
 *      tags every block from the opener through the closer with `oz-zone`.
 *
 * The markers themselves are stripped from the output in both cases.
 */

const OPEN = '[oz[';
const CLOSE = ']oz]';

function ozMarkers(md) {
  // ---------------------------------------------------------------------
  // Pass 1: inline spans (open + close within one block's inline source)
  // ---------------------------------------------------------------------
  md.inline.ruler.before('link', 'oz_marker', (state, silent) => {
    const src = state.src;
    const pos = state.pos;

    const isOpen = src.startsWith(OPEN, pos);
    const isClose = !isOpen && src.startsWith(CLOSE, pos);
    if (!isOpen && !isClose) return false;

    // `silent` means markdown-it is only probing for a match (e.g. while
    // validating a link label). Claim the match but never mutate state or
    // the open/close depth counter, which would desync on backtracking.
    if (silent) {
      state.pos += OPEN.length;
      return true;
    }

    if (isOpen) {
      // Only take this as an inline span if the closer is in the same inline
      // source. Otherwise it's a multi-block zone — leave the literal text
      // alone so the core rule below can pick it up.
      const closeAt = src.indexOf(CLOSE, pos + OPEN.length);
      if (closeAt === -1) return false;

      // An empty prompt — `[oz[ ]oz]`, written by /extensive-feedback to invite
      // a dictated answer — renders as a span wrapping nothing but whitespace,
      // which is invisible in the preview. That is exactly the marker you most
      // need to see, since it's the one still awaiting a reply. Flag it so the
      // stylesheet can draw a visible placeholder.
      const inner = src.slice(pos + OPEN.length, closeAt);
      const cls = /^\s*$/.test(inner) ? 'oz-note oz-empty' : 'oz-note';

      const token = state.push('html_inline', '', 0);
      token.content = '<span class="' + cls + '">';
      state.ozDepth = (state.ozDepth || 0) + 1;
      state.pos += OPEN.length;
      return true;
    }

    // Closer: only consume one that an inline opener actually claimed.
    if (!state.ozDepth) return false;
    const token = state.push('html_inline', '', 0);
    token.content = '</span>';
    state.ozDepth -= 1;
    state.pos += CLOSE.length;
    return true;
  });

  // ---------------------------------------------------------------------
  // Pass 2: multi-block zones (open and close in different blocks)
  // ---------------------------------------------------------------------
  // Runs after the `inline` core rule, so inline tokens already have their
  // children parsed and adjacent text fragments merged.
  md.core.ruler.push('oz_zones', (state) => {
    const tokens = state.tokens;
    let inZone = false;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      // Tag every top-level block that opens while a zone is active. The
      // opener's own block is tagged below, when the marker is found.
      if (inZone && token.nesting === 1) token.attrJoin('class', 'oz-zone');

      if (token.type !== 'inline' || !token.children) continue;

      let opensHere = false;
      let closesHere = false;

      for (const child of token.children) {
        if (child.type !== 'text' || !child.content) continue;
        if (child.content.includes(OPEN)) {
          child.content = child.content.split(OPEN).join('');
          opensHere = true;
          inZone = true;
        }
        if (child.content.includes(CLOSE)) {
          child.content = child.content.split(CLOSE).join('');
          closesHere = true;
        }
      }

      // Retro-tag the block that contains the opening marker: its
      // `*_open` token was emitted before we knew a zone started.
      // (Only on open: a continuation or closing block already got tagged
      // by the `inZone` branch above.)
      if (opensHere && i > 0) {
        for (let j = i - 1; j >= 0; j--) {
          if (tokens[j].nesting === 1) {
            tokens[j].attrJoin('class', 'oz-zone');
            break;
          }
        }
      }

      if (closesHere) inZone = false;
    }
  });
}

// VS Code calls this to hand us the preview's markdown-it instance.
exports.activate = () => ({
  extendMarkdownIt(md) {
    return md.use(ozMarkers);
  }
});
