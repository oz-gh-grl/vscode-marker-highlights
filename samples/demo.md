# Sample — round 2

Open this file's preview to see every shape the extension handles.
This mirrors the document layout `/extensive-feedback` produces.

## Open

**Q1. Should the commit step name exact paths?** Sweeping in untracked files is
the failure mode. Recommendation: name exact paths.

[oz[ yes, exact paths. this has bitten us before. ]oz]

**Q2. Do we default to open/settled zones?** The skill currently suggests asking
first, which costs a full round.

[oz[ i think you did the right thing and it should be the default behavior.

should we edit the skill to not suggest a conversation and default to
open/settled zones? that seems cleaner than asking every time.

- drop the "ask how you want the rounds structured" step
- document open/settled as the standing default

that's my whole answer. ]oz]

**Q3. Empty prompt, nothing said yet.**

[oz[ ]oz]

## Settled

**Q4.** Inline mid-sentence works too — the answer here is [oz[ option B, with
**bold** and `code` inside ]oz] and the sentence carries on afterward.

## Not highlighted (by design)

Writing *about* the convention uses a code span, so `[oz[ ... ]oz]` stays plain.
Same inside a fence:

```markdown
[oz[ your answer here ]oz]
```

That distinction matters: skill docs like `/extensive-feedback` discuss the
markers constantly, and those mentions must not look like live replies.
