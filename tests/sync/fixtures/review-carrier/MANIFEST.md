# Review-carrier fixtures (FR-051 carrier slice, ADR-015)

Raw Heretto output, captured 2026-11-02 over `GET /rest/all-files/<uuid>/content`
from the scratch topic named in `future-state/heretto-review-pi-grammar.md`
("Second pass"), with the author email and the `<author>` element scrubbed
exactly as `scripts/sample-heretto-corpus.ts` scrubs the sampled corpus.
Every other byte is as Heretto wrote it. Each file is byte-stable on an
unedited round trip (`tests/sync/review-carrier.test.ts`, I5).

| File | Provenance | Carries |
|---|---|---|
| `heretto-ct-del.dita` | step 01 of the second pass, verbatim | a pending `ct-ins` (" over here") and a `ct-del` ("existing") |
| `heretto-bold-wrap.dita` | step 03, verbatim | the same two, plus a bold toggle: a `ct-ins` pair straddling `<b>`'s start tag (unmapped) |
| `heretto-replace-pair.dita` | step 04 with its first `<p>` replaced by the baseline's first `<p>` (so the bold straddle is not in this file) | the `ct-ins` " over here", the `ct-del` "existing", and a replace: `ct-ins` "sentence" + `ct-del` "paragraph" sharing one changeId |
| `heretto-kitchen-sink.dita` | step 08, verbatim | everything above plus a `ct-del` "." , a `ct-ins` "Brand new paragraph", and a whole-element `ct-ins` around an empty `<p/>` (unmapped) |
| `heretto-split.dita` | the baseline shell with the first pass's worked-example body (2026-10-20, verbatim from the grammar doc) | a `ct-ins` in two fragments sharing one changeId across the split, and a `ct-split` |

The two real topics in `../sampled/` that carry a `comment` kind
(`topic/installation-codes.dita`,
`troubleshooting-topic/why-are-fleet-benchmarks-missing-when-i-use-multiple-databases.dita`)
are the fixtures for "a comment is not a suggestion".
