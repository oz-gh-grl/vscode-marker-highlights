/**
 * Renders samples/demo.md through the plugin and asserts the expected shapes.
 *
 *   node test/render-check.js
 *
 * Requires markdown-it on the module path (npm i markdown-it), which is why
 * it is a manual check rather than part of the packaged extension.
 *
 * Runs outside the extension host, so the 'vscode' module is unavailable and
 * extension.js falls back to its shipped default marker: `comment`, orange.
 * That's what this check exercises.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');
const ext = require('../extension.js');

const md = ext.activate().extendMarkdownIt(new MarkdownIt({ html: true }));
const src = fs.readFileSync(path.join(__dirname, '..', 'samples', 'demo.md'), 'utf8');
const html = md.render(src);

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

const results = [
  ['empty prompt tagged marker-empty', empties === 1, `got ${empties}, want 1 (Q3)`],
  ['inline spans rendered', notes === 3, `got ${notes}, want 3 (Q1, Q3 empty, Q4 mid-sentence)`],
  ['multi-block zone rendered', zones >= 4, `got ${zones}, want >= 4 (Q2 spans paragraphs + a list)`],
  ['markers inside code left alone', inCode === 2, `got ${inCode}, want 2`],
  ['no live markers leaked', leaked === 0, `got ${leaked}, want 0`]
];

let failed = 0;
for (const [name, ok, detail] of results) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failed++;
}
process.exit(failed ? 1 : 0);
