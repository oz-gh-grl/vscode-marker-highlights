# Marker Highlights — playground

Open the **preview** (`Ctrl+K V`) and put it beside this source. Both panes are
styled now, by two different mechanisms:

- the **source** pane by the Highlight extension + a regex in user settings
- the **preview** pane by the `marker-highlights` extension

Every section below is a case to look at. The annotation under each one says
what *should* happen — if the pane disagrees with the annotation, that's a bug
worth sending back.

This file uses the default `comment` tag (orange). If you've configured
additional tags in `markerHighlight.markers`, try swapping `comment` for one
of yours to see its color instead.

---

## 1. The common case: a whole-paragraph reply

**Q1. Should the commit step name exact paths?** Sweeping untracked files into a
commit is the failure mode we keep hitting.

[comment[ yes, exact paths. this has bitten us before. ]comment]

> Expect: one colored run, markers dimmed, no left rule.

---

## 2. A reply that runs across several blocks

**Q2. Do we default to open/settled zones?** The skill currently suggests asking
first, which costs a full round before any real work happens.

[comment[ i think you did the right thing and it should be the default behavior.

should we edit the skill to not suggest a conversation and just default to
open/settled zones? asking every time is friction nobody wants.

- drop the "ask how you want the rounds structured" step
- document open/settled as the standing default
- leave an escape hatch if a round genuinely needs a different shape

that's the whole answer. ]comment]

Back to the document here.

> Expect: a colored **left rule** down the whole reply — both paragraphs and
> the list — stopping before "Back to the document here." This is the
> `marker-zone` shape, and it's the reason a long dictated answer stays
> findable after the opening marker scrolls out of view.

---

## 3. The empty prompt

`/extensive-feedback` writes these for you to dictate into.

[comment[ ]comment]

> Expect: a dashed colored pill reading `[comment[  ]comment]`. An empty
> prompt wraps nothing but whitespace, so left alone it renders as literally
> nothing in the preview — and it's the marker that matters most, being the
> one still awaiting an answer. The stylesheet draws it explicitly rather
> than letting it vanish.

---

## 4. Inline, mid-sentence

**Q4.** Given the tradeoff above, my read is [comment[ option B, and don't overthink
it ]comment] — which keeps the rest of the sentence in normal body text.

> Expect: only the words between the markers change color. The surrounding
> sentence stays untouched.

---

## 5. Markdown inside a reply

[comment[ do the **bold** thing, call `metalmind-commit`, and see
[the spec](https://example.com) for why. Also *emphasis* survives. ]comment]

> Expect: bold, code span, link and emphasis all still render as formatting,
> and all of it stays colored rather than snapping back to body color.

---

## 6. Two replies in a row must not merge

**Q6a.** First question.

[comment[ first answer ]comment]

**Q6b.** Second question.

[comment[ second answer ]comment]

> Expect: two separate colored runs. The plain text between them ("**Q6b.**
> Second question.") must NOT be colored — if it is, the regex went greedy.

---

## 7. Writing *about* the markers (must stay plain)

A reviewer wraps dictation in `[comment[` and `]comment]`. A full empty
prompt looks like `[comment[ ]comment]`. Inside a fence:

```markdown
**Q1.** Some question the skill wrote.

[comment[ your answer here ]comment]
```

> Expect: **no color** anywhere in this section. Skill docs discuss these
> markers constantly, and those mentions must not masquerade as live replies.
> This is the case that separates a real implementation from a naive one.

---

## 8. A reply inside a list item

- **Q8.** Does this work in a bulleted question list?
  [comment[ yes, and it should stay inside the bullet ]comment]
- Next bullet, unaffected.

> Expect: color confined to the first bullet.

---

## 9. A reply inside a blockquote

> **Q9.** Quoted question from an earlier round.
>
> [comment[ answering inside the quote ]comment]

> Expect: color inside the quote, quote styling intact.

---

## 10. Unbalanced marker (the honest failure mode)

[comment[ this one is opened and never closed, on purpose

> Expect: everything from here to the end of the file goes colored in the
> preview. That's deliberate — an unclosed marker is a mistake you want to
> *see* immediately, not one that fails silently. Grep for `[comment[` if you
> ever need to find them; the count of openers and closers should always
> match.

---

## 11. Two different tags in the same document

This needs `markerHighlight.markers` to have at least two entries configured
(e.g. `comment` and `steve`) to see two colors here — otherwise the second
tag renders as plain literal text.

[comment[ this is the comment reviewer's note ]comment]

[steve[ this is steve's note, in a different color if configured ]steve]

> Expect: two distinctly colored runs, one per tag's configured color.

---

## 12. Nested markers, different tags, same paragraph

[comment[ outer note starts here — [steve[ a nested aside ]steve] — and outer
note continues ]comment]

> Expect: the whole run starts in comment's color, the nested aside switches
> to steve's color, and the text after it reverts to comment's color. This
> works because each tag gets its own `<span>`, nested like any other inline
> markup.

---

## 13. Nested markers, different tags, spanning blocks

[comment[ this comment zone opens here

[steve[ and a steve zone opens partway through, nested inside it

still inside steve's zone

]steve] back to just the comment zone

]comment]

> Expect: the first paragraph is comment-colored, the middle paragraphs
> switch to steve-colored once steve's zone opens, and the last paragraph
> before the close reverts to comment-colored. If a block is covered by two
> open zones at once, it shows the *innermost* one's color — a block can only
> carry one left-rule/background at a time, so nesting doesn't stack colors.
