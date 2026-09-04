/**
 * Renders samples/demo.md through the plugin and asserts the expected shapes.
 *
 *   node test/render-check.js
 *
 * Requires markdown-it on the module path (npm i markdown-it), which is why
 * it is a manual check rather than part of the packaged extension.
 *
 * Two renders. The first runs as the extension host is *not* available, so
 * extension.js falls back to its shipped default marker: `comment`, orange,
 * unlabeled. The second stubs the `vscode` module to supply a two-tag,
 * labeled config — the shape a real review document uses, and the only way to
 * exercise attribution labels at all, since the default marker has none.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');
const MarkdownIt = require('markdown-it');

const src = fs.readFileSync(path.join(__dirname, '..', 'samples', 'demo.md'), 'utf8');

function render(markers) {
  // Stub `vscode` for the duration of this render. extension.js requires it
  // lazily inside a try/catch, so swapping the loader is enough — and the
  // marker cache has to be dropped with it, since it outlives one render.
  const load = Module._load;
  if (markers) {
    Module._load = (request, ...rest) =>
      request === 'vscode'
        ? { workspace: { getConfiguration: () => ({ get: () => markers }) } }
        : load(request, ...rest);
  }
  try {
    delete require.cache[require.resolve('../extension.js')];
    const ext = require('../extension.js');
    return ext.activate().extendMarkdownIt(new MarkdownIt({ html: true })).render(src);
  } finally {
    Module._load = load;
  }
}

const html = render(null);
const count = (re) => (html.match(re) || []).length;

// Matches both `marker-note` and `marker-note marker-empty`.
const notes = count(/class="marker-note[" ]/g);
const zones = count(/class="marker-zone"/g);

// Markers written inside <code> must survive untouched — that is how the
// convention gets *documented* rather than *used*.
const inCode = (html.match(/<code\b[^>]*>[^<]*<\/code>/g) || [])
  .filter((c) => /\[comment\[|\]comment\]/.test(c)).length;

// Markers outside <code> must all be consumed. data-empty-text carries the
// marker text by design (it's what the empty-prompt placeholder displays),
// so it's excluded here rather than counted as a leak.
const stripped = html
  .replace(/<code\b[^>]*>[\s\S]*?<\/code>/g, '')
  .replace(/\sdata-empty-text="[^"]*"/g, '');
const leaked = (stripped.match(/\[comment\[|\]comment\]/g) || []).length;

// An empty prompt must be tagged so the stylesheet can draw a placeholder;
// otherwise it wraps whitespace only and vanishes in the preview.
const empties = count(/class="marker-note marker-empty"/g);

// Q5 — a zone opening partway through a list item. The bullet holds the
// document's own text *and* the start of the reply, so the reply is wrapped
// in a span and the item itself must stay untagged: tagging the whole block
// would paint the document's own words in the reviewer's color.
const bullet = (html.match(/<li[^>]*>\s*<code>\[~\]<\/code>[\s\S]*?<\/li>/) || [''])[0];
const bulletUntagged = bullet !== '' && !/<li class="marker-zone"/.test(bullet);
const bulletSpanned = /<span class="marker-note"[^>]*> <strong>Unblocked<\/strong>/.test(bullet);

// The same document under a real two-tag, labeled config. The label marks
// where a reply *starts*, so on a partially covered block it belongs on the
// span, never on the block — otherwise the preview credits the reviewer with
// the document text their reply happens to share a bullet with.
const labeled = render([
  { tag: 'comment', color: '#f0a558', label: 'Claude' },
  { tag: 'oz', color: '#4aa3ff', label: 'Oz' }
]);
const labeledBullet = (labeled.match(/<li[^>]*>\s*<code>\[~\]<\/code>[\s\S]*?<\/li>/) || [''])[0];
const labelOnSpan = /<span class="marker-note"[^>]*data-label="Claude"/.test(labeledBullet);
const labelOffBlock = labeledBullet !== '' && !/<li[^>]*data-label=/.test(labeledBullet);
// A fully covered block still gets the block treatment, label included (Q2).
const labeledBlocks = (labeled.match(/<p class="marker-zone"[^>]*data-label="Claude"/g) || []).length;

const results = [
  ['empty prompt tagged marker-empty', empties === 1, `got ${empties}, want 1 (Q3)`],
  ['inline spans rendered', notes === 4, `got ${notes}, want 4 (Q1, Q3 empty, Q4 mid-sentence, Q5 partial zone)`],
  ['multi-block zone rendered', zones >= 4, `got ${zones}, want >= 4 (Q2 spans paragraphs + a list)`],
  ['markers inside code left alone', inCode === 2, `got ${inCode}, want 2`],
  ['zone opened mid-bullet spans only the reply', bulletSpanned, `got ${bulletSpanned}, want true (Q5)`],
  ['zone opened mid-bullet leaves the <li> untagged', bulletUntagged, `got ${bulletUntagged}, want true (Q5)`],
  ['label sits on the span that starts the reply', labelOnSpan, `got ${labelOnSpan}, want true (Q5)`],
  ['label never fronts the document\'s own text', labelOffBlock, `got ${labelOffBlock}, want true (Q5)`],
  ['fully covered block still labeled', labeledBlocks === 1, `got ${labeledBlocks}, want 1 (Q2)`],
  ['no live markers leaked', leaked === 0, `got ${leaked}, want 0`]
];

let failed = 0;
for (const [name, ok, detail] of results) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failed++;
}
process.exit(failed ? 1 : 0);
