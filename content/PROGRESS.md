# Content progress

Phase 3 adds original, job-level (BS-5–BS-17) MCQs per book, in book order.
Every batch lives in `content/<book>/<chapter>.json`, passes
`node scripts/validate-content.mjs`, and is imported with a Supabase migration
(`supabase/00000000_<batch>.sql`, idempotent `on conflict (content_hash) do nothing`).

Quality gates (all enforced by the validator):
- question_en + question_ur, 4 distinct plausible options, exactly one correct
- correct answer stored as option TEXT, matching one option; A/B/C/D spread balanced
- 1–2 line explanation_en/explanation_ur (or an explicit empty string when the answer is self-evident)
- chapter, subject slug, exam tags from the per-exam syllabus windows, difficulty + level tiers
- no exact or near-duplicate of any existing question (legacy MD5 `content_hash` check)
- time-sensitive facts carry `as_of`, or are omitted; dubious rows are `needs_review` (never served)

Difficulty tiers (cognitive demand, BS-5–BS-17 — never CSS-essay level):
- easy/basic: one-step recall or recognition
- medium/intermediate: two-step reasoning, close distractors
- hard/advanced: multi-step application or analysis, near-miss distractors

## Books

| # | Book | Chapters | Rows live | Status |
| - | ---- | -------- | --------- | ------ |
| 1 | General Knowledge (500 Questions) | 5 (legacy ranges) | 480 | legacy seed, retagged + tiered 6 Nov 2026 |
| 2 | Pakistan Studies | indus-valley-civilization (39), sir-syed-aligarh-movement (29) | 67 | imported 6 Nov 2026 |
| 3 | Mathematics | arithmetic-number-systems (50) | 50 | imported 6 Nov 2026 |
| 4 | English | — | 0 | next chapter |
| 5 | Everyday Science | — | 0 | queued |
| 6 | Computer Skills | — | 0 | queued |

Production total: **597 live questions** (6 Nov 2026).

## No-repeat tests (6 Nov 2026)

Seen questions live in the browser (`dailytest.seen.v1`, newest 5000). The newest ids ride along
to `random_questions` as `p_exclude_ids`: unseen pool questions first, then the longest-ago seen
(wrong answers first). Same rule in the mock builder, the local mock server and the UI stub.
