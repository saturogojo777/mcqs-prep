-- DailyTest — professional edition.
-- Adds question metadata (level / difficulty / as_of / review_status), reported
-- questions, editable mock-test patterns, the ten core books, richer catalog
-- views and the query surface the new UI needs. Applied 2026-11-05.

-- ------------------------------------------------------------ question metadata

alter table public.mcqs
  add column if not exists difficulty text not null default 'medium',
  add column if not exists level text not null default 'intermediate',
  add column if not exists as_of date,
  add column if not exists review_status text not null default 'ai_verified';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mcqs_difficulty_check') then
    alter table public.mcqs add constraint mcqs_difficulty_check
      check (difficulty in ('easy', 'medium', 'hard'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mcqs_level_check') then
    alter table public.mcqs add constraint mcqs_level_check
      check (level in ('basic', 'intermediate', 'advanced'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mcqs_review_status_check') then
    alter table public.mcqs add constraint mcqs_review_status_check
      check (review_status in ('ai_verified', 'needs_review'));
  end if;
end $$;

create index if not exists mcqs_difficulty_idx on public.mcqs (difficulty);
create index if not exists mcqs_level_idx on public.mcqs (level);
create index if not exists mcqs_review_idx on public.mcqs (review_status);
create index if not exists mcqs_category_idx on public.mcqs (category_id);

-- Books belong to a core subject (one book per subject).
alter table public.books add column if not exists subject_id uuid references public.subjects(id) on delete set null;

-- ------------------------------------------------------------ reported questions

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  mcq_id uuid references public.mcqs(id) on delete cascade,
  reason text not null,
  note text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reports_status_check') then
    alter table public.reports add constraint reports_status_check
      check (status in ('open', 'fixed', 'ignored'));
  end if;
end $$;

alter table public.reports enable row level security;
-- No policies: written and read through the admin server routes (service role) only.

-- ------------------------------------------------------------ mock-test patterns

create table if not exists public.mock_patterns (
  exam_id uuid primary key references public.exams(id) on delete cascade,
  question_count int not null default 100,
  minutes int not null default 120,
  marks_per_question numeric(5, 2) not null default 1,
  negative_marking numeric(5, 2) not null default 0,
  passing_percentage int not null default 50,
  updated_at timestamptz not null default now()
);

alter table public.mock_patterns enable row level security;
drop policy if exists mock_patterns_read on public.mock_patterns;
create policy mock_patterns_read on public.mock_patterns
  for select to anon, authenticated using (true);

-- Editable starting points, NOT official patterns. The UI says so on screen.
insert into public.mock_patterns (exam_id, question_count, minutes, marks_per_question, negative_marking, passing_percentage)
select id, 100, 120, 1, 0, 50 from public.exams
on conflict (exam_id) do nothing;

-- ------------------------------------------------------------ the ten core books

insert into public.books (title, description, subject_id)
select v.title, v.description, s.id
from (values
  ('General Knowledge', 'General knowledge, Pakistan affairs, science and everyday awareness.', 'general-knowledge'),
  ('Pakistan Studies', 'Movement, constitution, foreign policy, economy, defence, Kashmir, geography and society.', 'pakistan-studies'),
  ('Islamic Studies', 'Quran, Hadith, Seerah, the Caliphs, pillars, history and notable figures.', 'islamic-studies'),
  ('Current Affairs', 'International institutions, treaties, security, economy, environment, Pakistan and the world.', 'current-affairs'),
  ('Geography', 'Geography of Pakistan and of the world.', 'geography'),
  ('Mathematics', 'Arithmetic, algebra, geometry, percentage, ratio, averages, interest and mensuration.', 'mathematics'),
  ('English', 'Grammar, parts of speech, prepositions, voice, idioms, vocabulary, analogies and correction.', 'english'),
  ('Urdu', 'Urdu grammar, idioms, proverbs, writers and poets.', 'urdu'),
  ('Everyday Science', 'Biology, physics, chemistry, the human body, inventions, space and environment.', 'everyday-science'),
  ('Computer Skills', 'Hardware, software, MS Office, the internet, email and IT figures.', 'computer-skills')
) as v(title, description, subject_slug)
join public.subjects s on s.slug = v.subject_slug
on conflict (title) do update
  set description = excluded.description,
      subject_id = excluded.subject_id;

-- The original seeded book becomes the General Knowledge book.
update public.books
set title = 'General Knowledge'
where title = 'General Knowledge (500 Questions)'
  and not exists (select 1 from public.books where title = 'General Knowledge');

update public.books b
set subject_id = s.id
from public.subjects s
where b.subject_id is null
  and (b.title = s.name
       or (b.title = 'General Knowledge' and s.slug = 'general-knowledge'));

-- ------------------------------------------------------------ catalog views

create or replace view public.subject_catalog as
select s.id, s.slug, s.name, s.name_ur, s.sort,
       coalesce(count(ms.mcq_id) filter (where m.review_status <> 'needs_review'), 0)::int as question_count
from public.subjects s
left join public.mcq_subjects ms on ms.subject_id = s.id
left join public.mcqs m on m.id = ms.mcq_id
group by s.id, s.slug, s.name, s.name_ur, s.sort;

create or replace view public.exam_catalog as
select e.id, e.slug, e.name, e.name_ur, e.sort,
       coalesce(count(me.mcq_id) filter (where m.review_status <> 'needs_review'), 0)::int as question_count
from public.exams e
left join public.mcq_exams me on me.exam_id = e.id
left join public.mcqs m on m.id = me.mcq_id
group by e.id, e.slug, e.name, e.name_ur, e.sort;

-- New columns cannot be inserted mid-view with CREATE OR REPLACE, so rebuild it.
drop view if exists public.book_catalog;

create or replace view public.book_catalog as
select b.id,
       b.title,
       b.description,
       b.subject_id,
       s.slug as subject_slug,
       s.name as subject_name,
       coalesce(count(m.id) filter (where m.review_status <> 'needs_review'), 0)::int as question_count,
       coalesce(count(distinct m.category_id), 0)::int as chapter_count
from public.books b
left join public.subjects s on s.id = b.subject_id
left join public.mcqs m on m.book_id = b.id
group by b.id, b.title, b.description, b.subject_id, s.slug, s.name;

create or replace view public.chapter_catalog as
select c.id, c.book_id, c.name as chapter,
       count(m.id) filter (where m.review_status <> 'needs_review')::int as question_count
from public.categories c
left join public.mcqs m on m.category_id = c.id
group by c.id, c.book_id, c.name;

grant select on public.subject_catalog, public.exam_catalog, public.book_catalog, public.chapter_catalog
  to anon, authenticated;

-- ------------------------------------------------------------ stats

create or replace function public.site_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'questions', (select count(*) from public.mcqs where review_status <> 'needs_review'),
    'subjects', (select count(*) from public.subjects),
    'exams', (select count(*) from public.exams),
    'books', (select count(*) from public.books),
    'chapters', (select count(*) from public.categories),
    'explanations', (select count(*) from public.mcqs
                     where review_status <> 'needs_review' and explanation is not null and btrim(explanation) <> '')
  );
$$;

grant execute on function public.site_stats() to anon, authenticated;

-- ------------------------------------------------------------ question RPCs

drop function if exists public.random_questions(text, text, int);
drop function if exists public.daily_questions(text, int);
drop function if exists public.questions_by_ids(uuid[]);

create or replace function public.random_questions(
  p_kind text,
  p_key text,
  p_limit int,
  p_difficulty text default null,
  p_level text default null
)
returns table (
  id uuid, question_en text, question_ur text, options jsonb, correct_text text,
  explanation text, chapter text, subject_slug text, level text, difficulty text
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.question_en, m.question_ur, m.options, m.correct_text, m.explanation,
         c.name as chapter,
         (select s.slug
            from public.mcq_subjects ms join public.subjects s on s.id = ms.subject_id
           where ms.mcq_id = m.id
           order by s.sort limit 1) as subject_slug,
         m.level, m.difficulty
  from public.mcqs m
  left join public.categories c on c.id = m.category_id
  where m.review_status <> 'needs_review'
    and (p_difficulty is null or p_difficulty = '' or m.difficulty = p_difficulty)
    and (p_level is null or p_level = '' or m.level = p_level)
    and case p_kind
      when 'exam' then exists (
        select 1 from public.mcq_exams me
        join public.exams e on e.id = me.exam_id
        where me.mcq_id = m.id and e.slug = p_key
      )
      when 'subject' then exists (
        select 1 from public.mcq_subjects ms
        join public.subjects s on s.id = ms.subject_id
        where ms.mcq_id = m.id and s.slug = p_key
      )
      when 'book' then m.book_id::text = p_key
      else false
    end
  order by random()
  limit greatest(1, least(coalesce(p_limit, 10), 500));
$$;

create or replace function public.daily_questions(
  p_seed text,
  p_limit int default 10,
  p_difficulty text default null,
  p_level text default null
)
returns table (
  id uuid, question_en text, question_ur text, options jsonb, correct_text text,
  explanation text, chapter text, subject_slug text, level text, difficulty text
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.question_en, m.question_ur, m.options, m.correct_text, m.explanation,
         c.name as chapter,
         (select s.slug
            from public.mcq_subjects ms join public.subjects s on s.id = ms.subject_id
           where ms.mcq_id = m.id
           order by s.sort limit 1) as subject_slug,
         m.level, m.difficulty
  from public.mcqs m
  left join public.categories c on c.id = m.category_id
  where m.review_status <> 'needs_review'
    and (p_difficulty is null or p_difficulty = '' or m.difficulty = p_difficulty)
    and (p_level is null or p_level = '' or m.level = p_level)
  order by md5(m.id::text || coalesce(p_seed, ''))
  limit greatest(1, least(coalesce(p_limit, 10), 500));
$$;

create or replace function public.questions_by_ids(p_ids uuid[])
returns table (
  id uuid, question_en text, question_ur text, options jsonb, correct_text text,
  explanation text, chapter text, subject_slug text, level text, difficulty text
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.question_en, m.question_ur, m.options, m.correct_text, m.explanation,
         c.name as chapter,
         (select s.slug
            from public.mcq_subjects ms join public.subjects s on s.id = ms.subject_id
           where ms.mcq_id = m.id
           order by s.sort limit 1) as subject_slug,
         m.level, m.difficulty
  from public.mcqs m
  left join public.categories c on c.id = m.category_id
  where m.id = any (coalesce(p_ids, '{}'::uuid[]))
    and m.review_status <> 'needs_review';
$$;

grant execute on function public.random_questions(text, text, int, text, text) to anon, authenticated;
grant execute on function public.daily_questions(text, int, text, text) to anon, authenticated;
grant execute on function public.questions_by_ids(uuid[]) to anon, authenticated;

-- ------------------------------------------------------------ JSON book import

create or replace function public.import_book(p_book jsonb, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text := nullif(btrim(p_book->>'title'), '');
  v_subject_key text := nullif(btrim(p_book->>'subject'), '');
  v_book_subject uuid;
  v_book_id uuid;
  v_subject_id uuid;
  v_category_id uuid;
  v_chapter text;
  v_exam_id uuid;
  v_exam_key text;
  v_new_id uuid;
  v_row jsonb;
  v_imported int := 0;
  v_skipped int := 0;
  v_invalid int := 0;
  v_review text;
  v_difficulty text;
  v_level text;
  v_as_of date;
begin
  if v_title is null then
    raise exception 'Book title is required';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'No rows to import';
  end if;

  insert into public.books (title) values (v_title) on conflict (title) do nothing;
  select id, subject_id into v_book_id, v_book_subject from public.books where title = v_title;

  if v_subject_key is not null then
    select id into v_subject_id
    from public.subjects
    where slug = v_subject_key or lower(name) = lower(v_subject_key) or name_ur = v_subject_key
    limit 1;
  end if;
  v_subject_id := coalesce(v_subject_id, v_book_subject);

  if v_subject_id is not null and v_book_subject is null then
    update public.books set subject_id = v_subject_id where id = v_book_id;
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    if coalesce(btrim(v_row->>'question_en'), '') = '' or coalesce(btrim(v_row->>'correct_text'), '') = '' then
      v_invalid := v_invalid + 1;
      continue;
    end if;

    v_chapter := coalesce(nullif(btrim(v_row->>'chapter'), ''),
                          nullif(btrim(v_row->>'category'), ''),
                          nullif(v_row->>'chapter_name', ''),
                          v_subject_key, 'General');
    insert into public.categories (book_id, name) values (v_book_id, v_chapter)
      on conflict (book_id, name) do nothing;
    select id into v_category_id from public.categories where book_id = v_book_id and name = v_chapter;

    v_review := case when v_row->>'review_status' = 'needs_review' then 'needs_review' else 'ai_verified' end;
    v_difficulty := case when v_row->>'difficulty' in ('easy', 'medium', 'hard')
                         then v_row->>'difficulty' else 'medium' end;
    v_level := case when v_row->>'level' in ('basic', 'intermediate', 'advanced')
                    then v_row->>'level' else 'intermediate' end;
    begin
      v_as_of := nullif(btrim(coalesce(v_row->>'as_of', '')), '')::date;
    exception when others then
      v_as_of := null;
    end;

    v_new_id := null;
    insert into public.mcqs (
      book_id, category_id, question_en, question_ur, options, correct_text,
      explanation, source_ref, difficulty, level, as_of, review_status
    )
    values (
      v_book_id, v_category_id,
      btrim(v_row->>'question_en'),
      nullif(btrim(coalesce(v_row->>'question_ur', '')), ''),
      coalesce(v_row->'options', '{}'::jsonb),
      btrim(v_row->>'correct_text'),
      nullif(btrim(coalesce(v_row->>'explanation', '')), ''),
      nullif(btrim(coalesce(v_row->>'source_ref', '')), ''),
      v_difficulty, v_level, v_as_of, v_review
    )
    on conflict (content_hash) do nothing
    returning id into v_new_id;

    if v_new_id is null then
      v_skipped := v_skipped + 1;
    else
      v_imported := v_imported + 1;
      if v_subject_id is not null then
        insert into public.mcq_subjects (mcq_id, subject_id) values (v_new_id, v_subject_id)
          on conflict do nothing;
      end if;
      for v_exam_key in select value from jsonb_array_elements_text(
        coalesce(v_row->'exams', p_book->'exams', '[]'::jsonb)
      ) loop
        select id into v_exam_id from public.exams
          where slug = v_exam_key or lower(name) = lower(v_exam_key) limit 1;
        if v_exam_id is not null then
          insert into public.mcq_exams (mcq_id, exam_id) values (v_new_id, v_exam_id)
            on conflict do nothing;
        end if;
      end loop;
    end if;
  end loop;

  return jsonb_build_object(
    'book_id', v_book_id, 'imported', v_imported, 'skipped', v_skipped, 'invalid', v_invalid
  );
end;
$$;

revoke all on function public.import_book(jsonb, jsonb) from public;
revoke all on function public.import_book(jsonb, jsonb) from anon;
revoke all on function public.import_book(jsonb, jsonb) from authenticated;
grant execute on function public.import_book(jsonb, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Note on applying this file
--
-- A database that already had the single demo book "General Knowledge (500
-- Questions)" needs that book folded into the new "General Knowledge" book
-- before the 10-book set is complete. The statements below are idempotent and
-- safe on a fresh project (where the old title does not exist):
--
--   do $$
--   declare old_id uuid; new_id uuid; r record; new_cat uuid;
--   begin
--     select id into old_id from public.books where title = 'General Knowledge (500 Questions)';
--     select id into new_id from public.books where title = 'General Knowledge';
--     if old_id is null or new_id is null or old_id = new_id then return; end if;
--     for r in select id, name from public.categories where book_id = old_id loop
--       insert into public.categories (book_id, name) values (new_id, r.name)
--         on conflict (book_id, name) do nothing;
--       select id into new_cat from public.categories where book_id = new_id and name = r.name;
--       update public.mcqs set book_id = new_id, category_id = new_cat
--         where book_id = old_id and category_id = r.id;
--     end loop;
--     update public.mcqs set book_id = new_id where book_id = old_id;
--     delete from public.categories where book_id = old_id;
--     delete from public.books where id = old_id;
--   end $$;
