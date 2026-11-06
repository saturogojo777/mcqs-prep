# DailyTest

**Daily practice for Pakistan's exams** — <https://mcqs-prep-eta.vercel.app> · admin at `/admin`.

One screen, three choices: **Exam**, **Subject** or **Book**. Pick one, pick how many questions,
press Start. No sign-up, no login, no dashboards. Everything works in English and in اردو (real
RTL with a bundled Nastaliq face), light and dark follow the device.

- **Today's Test** — 10 questions seeded from the date, so every visitor gets the same set each day.
- **Start screen** — 10 / 20 / 50 / 100 or a custom number, difficulty (easy / medium / hard / mixed),
  level (basic / intermediate / advanced / mixed), an optional timer, and two modes.
- **Practice** — one question at a time, four options shuffled on every display, checked by option
  *text* (never by letter). Right answer: light green. Wrong: light red plus the correct answer and
  its explanation.
- **Mock Test** — like the exam hall: countdown, question palette (answered / unanswered / marked),
  mark for review, submit with a confirmation, then marks with negative marking and a pass line.
  The per-exam pattern is editable in `/admin/patterns`; the screen always says to verify it with the
  official advertisement.
- **Result** — score ring, percentage, time, marks (mock), accuracy bars by subject and chapter, the
  weak topics, and every missed question with the right answer and explanation in green.
  *Try again*, *Practise my mistakes*, *Home*.
- **`/progress`** — tests taken, daily streak and accuracy per subject, from `localStorage` only.
  Nothing about a student leaves the browser.
- **Report a question** — every question carries a report link; reports land in `reports` (RLS on, no
  public policies) and are triaged in `/admin/reports`.

## Stack

| Piece | Usage |
| --- | --- |
| Next.js 16 (App Router) | pages, server rendering, the two API routes |
| Supabase Postgres | subjects / exams / books / mcqs / messages, RLS: public read, no public write |
| Vercel | hosting, env vars, build-time seed |
| Google Sheets | optional: draft a new book as rows, then import from `/admin` |

## Data model

```
books        (id, title unique, description)
categories   (id, book_id, name, unique(book_id, name))
mcqs         (id, book_id, category_id, question_en, question_ur, options jsonb {A,B,C,D},
              correct_text, explanation, source_ref, content_hash unique,
              level, difficulty, as_of, review_status)
subjects     (id, slug unique, name, name_ur, sort)
exams        (id, slug unique, name, name_ur, sort)
mcq_subjects (mcq_id, subject_id)            -- many to many
mcq_exams    (mcq_id, exam_id)               -- many to many
messages     (id, name, email, message, created_at, handled)   -- contact form, server only
reports      (id, mcq_id, reason, note, status, created_at)     -- wrong-question reports
mock_patterns(exam_id, question_count, minutes, marks_per_question,
              negative_marking, passing_percentage, updated_at)
```

`level` is basic / intermediate / advanced, `difficulty` easy / medium / hard, `as_of` dates any
time-sensitive fact, and `review_status` is `ai_verified` or `needs_review`. **`needs_review`
questions are never served to a test** — every RPC filters them out and the catalog views count them
separately, so the admin dashboard can show how many are waiting per book.

- `correct_text` stores the **answer text**, never the letter, so options can be shuffled.
- `content_hash` is a generated column: `md5(lower(trim(question)) + '|' + options sorted, lowercased)`.
  The unique index makes duplicates impossible, whichever client inserts.
- RLS is on everywhere: `select` for `anon`, no write policies. Only the service role key — server
  side, never shipped to the browser — can write.
- Four read-only views (`exam_catalog`, `subject_catalog`, `book_catalog`, `chapter_catalog`) give
  every list page its name plus question count in one round trip, and `site_stats()` feeds the
  numbers on the home page.
- Questions are handed to the browser by three `security definer` functions:
  `random_questions(kind, key, limit, difficulty, level)`, `daily_questions(seed, limit, difficulty,
  level)`, `questions_by_ids(uuid[])`. Each returns `chapter`, `subject_slug`, `level` and
  `difficulty` so the result screen can break accuracy down by topic.
- `import_book(book jsonb, rows jsonb)` writes a whole book in one Postgres call, so an import is
  never half-saved. It is executable by `service_role` only.

Schema: `supabase/20261105_dailytest.sql` (base) and `supabase/20261105_professional.sql`
(metadata, reports, mock patterns, books, catalog views, `site_stats`, the extended RPCs and the new
`import_book`). Both are applied to the project.

## Pages

| Route | What it is |
| --- | --- |
| `/` | logo, search, EN/اردو toggle, Exam / Subject / Book, Today's Test, live stats, popular exams, subjects, books, how it works, why, FAQ, full footer |
| `/exams`, `/subjects`, `/books` | one card per item with its question count and chapters ("Coming soon" when empty) |
| `/practice/[kind]/[key]` | start screen (mode, count, difficulty, level, timer) → practice quiz or mock test → result |
| `/today` | Today's Test, straight into the questions |
| `/mistakes` | replays the questions answered wrongly last time |
| `/progress` | tests taken, streak, accuracy per subject (localStorage) |
| `/search` | full results for the header search |
| `/about`, `/contact`, `/privacy`, `/terms`, `/disclaimer` | plain-English footer pages |
| `/admin` | sign in, then import questions |
| `/admin/dashboard` | MCQs per book and chapter, `needs_review` queue, open reports |
| `/admin/reports` | reported questions, edit / delete, mark fixed or ignored |
| `/admin/patterns` | mock-test pattern per exam |

A custom `app/not-found.tsx` handles 404s, `app/icon.svg` is the favicon and `public/og.png` the
social card (`node scripts/dev/make-og.mjs` rebuilds it).

`sitemap.xml` and `robots.txt` are generated from `lib/site.ts`. Nothing hardcodes a domain:
`NEXT_PUBLIC_SITE_URL` drives the canonical URL, the sitemap and the social tags.

## Admin: adding a book from JSON

`/admin` → **JSON book file**. One file is one book. Each row:

```json
{
  "id": 1,
  "question_en": "Which gas do plants take in during photosynthesis?",
  "question_ur": "پودے روشنی ترکیب کے دوران کون سی گیس لیتے ہیں؟",
  "options": { "A": "Carbon dioxide", "B": "Oxygen", "C": "Nitrogen", "D": "Hydrogen" },
  "correct_answer": "Carbon dioxide",
  "book": "Everyday Science Starter (20 Questions)",
  "subject": "everyday-science",
  "exams": ["ppsc", "nts-pts-ots"],
  "explanation": "Plants use carbon dioxide and water to make glucose."
}
```

Only `question_en`, four distinct `options`, and a `correct_answer` that matches one of them are
required. `book`, `subject`, `exams`, `explanation` and `question_ur` are optional; `book` falls back
to the name typed in the form, `category` falls back to the subject.

Press **Preview** to see every row as **new / duplicate / invalid** with the reason, then **Import**.
Only valid new rows are written; the book, its category and the subject/exam tags are created
automatically. A ready-made example ships as [`public/sample-book.json`](public/sample-book.json)
(20 questions, English + Urdu), linked from the admin screen.

The Google Sheet and paste tabs still work with the original column layout:
`book, category, question_en, question_ur, option_a..option_d, correct_answer, explanation`.

## Design system

One monochrome token set in `app/globals.css`:

| Token | Light | Dark |
| --- | --- | --- |
| `--bg` / `--bg-soft` | `#ffffff` / `#f6f6f7` | `#0a0a0b` / `#141416` |
| `--fg` / `--fg-muted` | `#101012` / `#5b5b62` | `#f4f4f5` / `#a5a5ad` |
| `--line` / `--line-strong` | `#e2e2e6` / `#c9c9d0` | `#26262b` / `#3a3a42` |
| `--ok-*` (correct) | `#e7f6ec` tint / `#1a6b3d` text | `#10281b` / `#6fd69b` |
| `--bad-*` (wrong) | `#fdeaea` tint / `#9c1f1f` text | `#2a1414` / `#f0a2a2` |

- Colour carries meaning in exactly one place: right / wrong answers. Everything else is black,
  white and grey. Measured contrast: 19.8 (body), 5.33 (muted), 4.79 (green), 6.05 (red) in light;
  19.6 / 7.8 / 10.1 / 6.58 in dark — all WCAG AA.
- Type: Inter Variable for English, bundled Noto Nastaliq Urdu for اردو. Server components render
  **both** languages as `.t-en` / `.t-ur`; CSS shows the one matching `html[dir]`, so there is no
  flash and no hydration mismatch. A tiny inline script applies the saved language before first paint.
- Numbers stay left-to-right inside Urdu sentences (`<Num>` → `.num`, `unicode-bidi: isolate`).
- Motion is CSS only and respects `prefers-reduced-motion`.

## Local development

```bash
npm install
cp .env.example .env.local          # Supabase URL + keys
npm run dev                         # http://localhost:3000
npm test                            # import validation / dedupe (21 tests)
npm run test:ui                     # jsdom run of the real practice flow (15 checks)
```

### Design QA

`npm run audit:ui` drives real Chromium against a local build, screenshots every screen at
360 / 768 / 1280 in English and Urdu, light and dark, and fails if anything scrolls sideways, clips
text, drops out of RTL, or uses a colour outside the palette.

The sandbox cannot reach Supabase, so QA runs against a local stand-in that serves the same
endpoints from `data/mcqs_all_1to500.json`:

```bash
node scripts/dev/setup-chromium.mjs          # once per fresh sandbox
node scripts/dev/mock-supabase.mjs &         # REST stand-in on :3101
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3101 npm run build && npm start
node scripts/dev/shots.mjs http://127.0.0.1:3100   # screenshots/ (76 screens)
```

## Environment variables

| Name | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser | public read key (RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | admin import, contact form, build seed |
| `ADMIN_EMAIL` | server only | the only email allowed into `/admin` |
| `ADMIN_ACCESS_KEY` | server only | the access key typed at `/admin` |
| `ADMIN_SESSION_SECRET` | server only | signs the admin session cookie |
| `NEXT_PUBLIC_SITE_URL` | browser + server | canonical URL, sitemap, social tags (set to the real domain) |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | browser | optional; ads render only once this is set |

## Seed

`npm run seed` inserts `data/mcqs_all_1to500.json` plus every batch in `content/`, then runs
automatically during the Vercel build (`vercel-build`). It is idempotent: questions use
`on conflict (content_hash) do nothing` and tags use `ignoreDuplicates`, so re-deploys never
duplicate anything.

Every question carries one real subject tag and an audited difficulty/level tier
(`content/audit/difficulty-489.json` for the legacy rows; each content batch declares its own).
Exam tags follow per-exam syllabus windows over those tiers, so counts are honest everywhere:
each card shows its own tag count, and subjects or exams with no questions show "Coming soon".
`needs_review` rows are stored but never served to tests. As of 6 Nov 2026 production holds
597 live questions across 7 subjects, 9 exams, 3 books and 8 chapters.

Tests never repeat a question without asking: every question shown is recorded in the browser's
`dailytest.seen.v1` map (`lib/seen.ts`, newest 5000 kept), and `random_questions`/`pool_seen_stats`
take the newest ids as `p_exclude_ids` — unseen first, then longest-ago seen (wrong answers ahead).
The start screen shows "X new for you of Y" with an "Only new questions" switch and an all-seen
empty state ("Start a fresh round" clears that pool only); Progress shows "Seen N of M" per subject
with a history reset; Today's Test finishes once per day and then shows a Done card with the score.
