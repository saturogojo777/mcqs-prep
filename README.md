# MCQ Practice

**Live:** https://mcqs-prep-eta.vercel.app · **Admin:** https://mcqs-prep-eta.vercel.app/admin

A small, fast MCQ practice site for Pakistani exam preparation. Mobile first, English / اردو (RTL),
light and dark following the device. No accounts, no tracking: progress lives in the browser.

- **Practice** one question at a time with instant right / wrong feedback.
- **Test** mode: 10 random questions, score at the end.
- **/admin**: add new books from a Google Sheet, a pasted table, or a JSON/CSV file.

## Stack

| Piece | Usage |
| --- | --- |
| Next.js 16 (App Router) | UI + the two admin API routes |
| Supabase Postgres | books / categories / mcqs, RLS: public read, no public write |
| Vercel | hosting, env vars, build time seed |
| Google Sheets | where new book MCQs are drafted before import |

## Data model

```
books       (id, title unique, description)
categories  (id, book_id, name, unique(book_id, name))
mcqs        (id, book_id, category_id, question_en, question_ur, options jsonb {A,B,C,D},
             correct_text, explanation, source_ref, content_hash unique)
```

- `correct_text` stores the **answer text**, never the letter, so options can be shuffled freely.
- `content_hash` is a generated column: `md5(lower(trim(question)) + '|' + options sorted, lowercased)`.
  The unique index on it makes duplicates impossible, whichever client inserts.
- RLS is on for all three tables: `select` for `anon` / `authenticated`, no write policies at all.
  Only the service role key (server side, never shipped to the browser) can write.

## Admin access

`/admin` asks for the admin email (`ADMIN_EMAIL`) and the access key (`ADMIN_ACCESS_KEY`). Both live in
Vercel environment variables only. A successful sign in sets a signed, HttpOnly cookie; every admin API
route re-checks the signature and the email against `ADMIN_EMAIL`, so nobody else can import. The
browser never sees the service role key: writes only ever happen inside those server routes.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the Supabase values
npm run dev                  # http://localhost:3000
npm test                     # import validation / dedupe tests
npm run test:ui              # headless (jsdom) run of the practice + test flow
```

## Environment variables

| Name | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser | public read key (RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | admin import + build seed |
| `ADMIN_EMAIL` | server only | the only email allowed into `/admin` |
| `ADMIN_ACCESS_KEY` | server only | the access key typed at `/admin` |
| `ADMIN_SESSION_SECRET` | server only | signs the admin session cookie |

## Adding a new book

1. Open the [import template](https://docs.google.com/spreadsheets/d/13d2QDw9kvtUgHj-YofgBuwZPJIQMHJu05Qd-XlNhLV8/edit)
   (or any sheet with the same header row).
2. One question per row: `book`, `category`, `question_en`, `question_ur`, `option_a`..`option_d`,
   `correct_answer`, `explanation`.
3. Share the sheet as *Anyone with the link → Viewer*, then go to `/admin`, paste the sheet link and
   press **Preview**.
   (Private sheets can be pasted straight into the "Paste / upload file" tab instead.)
4. Preview shows every row as **new**, **duplicate** or **invalid** with the reason. Only new rows are
   imported; books and categories are created automatically.

`correct_answer` may be a letter (`A`–`D`, `1`–`4`) or the exact option text.

## Seeding the first book

`npm run seed` inserts `data/mcqs_all_1to500.json` as **General Knowledge (500 Questions)** and is run
automatically during the Vercel build (`vercel-build`). It is idempotent: rows are inserted with
`on conflict (content_hash) do nothing`, so re-deploys never duplicate anything.

The dataset holds 500 rows and 11 exact repeats, so 489 unique questions are stored.
Categories come from the source ids: 1–100 Pakistan GK & Constitution, 101–200 Pakistan Geography &
Symbols, 201–300 International Organizations & Days, 301–400 Science & Computer, 401–500 Math & English.
