# Oz Markers — playground

Open the **preview** (`Ctrl+K V`) and put it beside this source. Both panes are
styled now, by two different mechanisms:

- the **source** pane by the Highlight extension + a regex in user settings
- the **preview** pane by the `oz-markers` extension

Every section below is a case to look at. The annotation under each one says
what *should* happen — if the pane disagrees with the annotation, that's a bug
worth sending back.

---

## 1. The common case: a whole-paragraph reply

**Q1. Should the commit step name exact paths?** Sweeping untracked files into a
commit is the failure mode we keep hitting.

[oz[ yes, exact paths. this has bitten us before. ]oz]

> Expect: one orange run, markers dimmed, no left rule.

---

## 2. A reply that runs across several blocks

**Q2. Do we default to open/settled zones?** The skill currently suggests asking
first, which costs a full round before any real work happens.

[oz[ i think you did the right thing and it should be the default behavior.

should we edit the skill to not suggest a conversation and just default to
open/settled zones? asking every time is friction nobody wants.

- drop the "ask how you want the rounds structured" step
- document open/settled as the standing default
- leave an escape hatch if a round genuinely needs a different shape

that's the whole answer. ]oz]

Back to the document here.

> Expect: an orange **left rule** down the whole reply — both paragraphs and the
> list — stopping before "Back to the document here." This is the `oz-zone`
> shape, and it's the reason a long dictated answer stays findable after the
> opening marker scrolls out of view.

---

## 3. The empty prompt

`/extensive-feedback` writes these for you to dictate into.

[oz[ ]oz]

> Expect: a dashed orange pill reading `[oz[  ]oz]`. An empty prompt wraps
> nothing but whitespace, so left alone it renders as literally nothing in the
> preview — and it's the marker that matters most, being the one still awaiting
> an answer. The stylesheet draws it explicitly rather than letting it vanish.

---

## 4. Inline, mid-sentence

**Q4.** Given the tradeoff above, my read is [oz[ option B, and don't overthink
it ]oz] — which keeps the rest of the sentence in normal body text.

> Expect: only the words between the markers turn orange. The surrounding
> sentence stays untouched.

---

## 5. Markdown inside a reply

[oz[ do the **bold** thing, call `metalmind-commit`, and see
[the spec](https://example.com) for why. Also *emphasis* survives. ]oz]

> Expect: bold, code span, link and emphasis all still render as formatting,
> and all of it stays orange rather than snapping back to body color.

---

## 6. Two replies in a row must not merge

**Q6a.** First question.

[oz[ first answer ]oz]

**Q6b.** Second question.

[oz[ second answer ]oz]

> Expect: two separate orange runs. The plain text between them ("**Q6b.**
> Second question.") must NOT be orange — if it is, the regex went greedy.

---

## 7. Writing *about* the markers (must stay plain)

Oz wraps dictation in `[oz[` and `]oz]`. A full empty prompt looks like
`[oz[ ]oz]`. Inside a fence:

```markdown
**Q1.** Some question the skill wrote.

[oz[ your answer here ]oz]
```

> Expect: **no orange** anywhere in this section. Skill docs discuss these
> markers constantly, and those mentions must not masquerade as live replies.
> This is the case that separates a real implementation from a naive one.

---

## 8. A reply inside a list item

- **Q8.** Does this work in a bulleted question list?
  [oz[ yes, and it should stay inside the bullet ]oz]
- Next bullet, unaffected.

> Expect: orange confined to the first bullet.

---

## 9. A reply inside a blockquote

> **Q9.** Quoted question from an earlier round.
>
> [oz[ answering inside the quote ]oz]

> Expect: orange inside the quote, quote styling intact.

---

## 10. Unbalanced marker (the honest failure mode)

[oz[ this one is opened and never closed, on purpose

> Expect: everything from here to the end of the file goes orange in the
> preview. That's deliberate — an unclosed marker is a mistake you want to
> *see* immediately, not one that fails silently. Grep for `[oz[` if you ever
> need to find them; the count of openers and closers should always match.
