-- DailyTest schema: subjects, exams, tags, catalog views, question RPCs, JSON book import.
-- Applied to the Supabase project on 2026-11-05 (see README).

-- ---------------------------------------------------------------- tables

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  name_ur text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  name_ur text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.mcq_subjects (
  mcq_id uuid not null references public.mcqs(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  primary key (mcq_id, subject_id)
);

create table if not exists public.mcq_exams (
  mcq_id uuid not null references public.mcqs(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  primary key (mcq_id, exam_id)
);

-- Contact form messages. Written only by the server route (service role); no public policies.
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now(),
  handled boolean not null default false
);

alter table public.subjects enable row level security;
alter table public.exams enable row level security;
alter table public.mcq_subjects enable row level security;
alter table public.mcq_exams enable row level security;
alter table public.messages enable row level security;

drop policy if exists subjects_read on public.subjects;
create policy subjects_read on public.subjects for select to anon, authenticated using (true);

drop policy if exists exams_read on public.exams;
create policy exams_read on public.exams for select to anon, authenticated using (true);

drop policy if exists mcq_subjects_read on public.mcq_subjects;
create policy mcq_subjects_read on public.mcq_subjects for select to anon, authenticated using (true);

drop policy if exists mcq_exams_read on public.mcq_exams;
create policy mcq_exams_read on public.mcq_exams for select to anon, authenticated using (true);

create index if not exists mcq_subjects_subject_idx on public.mcq_subjects (subject_id);
create index if not exists mcq_exams_exam_idx on public.mcq_exams (exam_id);

-- ---------------------------------------------------------------- seed lists

insert into public.subjects (slug, name, name_ur, sort) values
  ('general-knowledge', 'General Knowledge', 'عام معلومات', 1),
  ('pakistan-studies', 'Pakistan Studies', 'مطالعہ پاکستان', 2),
  ('islamic-studies', 'Islamic Studies', 'اسلامیات', 3),
  ('current-affairs', 'Current Affairs', 'حالاتِ حاضرہ', 4),
  ('geography', 'Geography', 'جغرافیہ', 5),
  ('mathematics', 'Mathematics', 'ریاضی', 6),
  ('english', 'English', 'انگریزی', 7),
  ('urdu', 'Urdu', 'اردو', 8),
  ('everyday-science', 'Everyday Science', 'روزمرہ سائنس', 9),
  ('computer-skills', 'Computer Skills', 'کمپیوٹر', 10)
on conflict (slug) do update
  set name = excluded.name, name_ur = excluded.name_ur, sort = excluded.sort;

insert into public.exams (slug, name, name_ur, sort) values
  ('ppsc', 'PPSC', 'پی پی ایس سی', 1),
  ('fpsc', 'FPSC', 'ایف پی ایس سی', 2),
  ('spsc', 'SPSC', 'ایس پی ایس سی', 3),
  ('nts-pts-ots', 'NTS/PTS/OTS', 'این ٹی ایس / پی ٹی ایس / او ٹی ایس', 4),
  ('css-pms', 'CSS/PMS', 'سی ایس ایس / پی ایم ایس', 5),
  ('mdcat-ecat', 'MDCAT/ECAT', 'ایم ڈی کیٹ / ای سی اے ٹی', 6),
  ('forces', 'Forces', 'دفاعی محکمے', 7),
  ('police', 'Police', 'پولیس', 8),
  ('teachers', 'Teachers', 'اساتذہ', 9)
on conflict (slug) do update
  set name = excluded.name, name_ur = excluded.name_ur, sort = excluded.sort;

-- ---------------------------------------------------------------- tag the existing book

-- Pakistan GK & Constitution  -> Pakistan Studies
-- Pakistan Geography & Symbols -> Geography
-- International Organizations & Days -> Current Affairs
-- Science & Computer -> Everyday Science (source ids 301-350) / Computer Skills (351-400)
-- Math & English -> Mathematics (401-450) / English (451-500)
with mapping as (
  select
    m.id,
    case c.name
      when 'Pakistan GK & Constitution' then 'pakistan-studies'
      when 'Pakistan Geography & Symbols' then 'geography'
      when 'International Organizations & Days' then 'current-affairs'
      when 'Science & Computer' then
        case when coalesce(nullif(btrim(m.source_ref), '')::int, 0) <= 350 then 'everyday-science' else 'computer-skills' end
      when 'Math & English' then
        case when coalesce(nullif(btrim(m.source_ref), '')::int, 0) <= 450 then 'mathematics' else 'english' end
    end as slug
  from public.mcqs m
  join public.categories c on c.id = m.category_id
)
insert into public.mcq_subjects (mcq_id, subject_id)
select mapping.id, s.id
from mapping
join public.subjects s on s.slug = mapping.slug
where mapping.slug is not null
on conflict do nothing;

-- the whole book is general knowledge, so every question also answers that subject
insert into public.mcq_subjects (mcq_id, subject_id)
select m.id, s.id from public.mcqs m cross join public.subjects s
where s.slug = 'general-knowledge'
on conflict do nothing;

-- no exam-specific tagging exists in the source data yet, so every question is offered for every exam
insert into public.mcq_exams (mcq_id, exam_id)
select m.id, e.id from public.mcqs m cross join public.exams e
on conflict do nothing;

-- ---------------------------------------------------------------- catalog views

create or replace view public.subject_catalog as
select s.id, s.slug, s.name, s.name_ur, s.sort,
       coalesce(count(ms.mcq_id), 0)::int as question_count
from public.subjects s
left join public.mcq_subjects ms on ms.subject_id = s.id
group by s.id, s.slug, s.name, s.name_ur, s.sort;

create or replace view public.exam_catalog as
select e.id, e.slug, e.name, e.name_ur, e.sort,
       coalesce(count(me.mcq_id), 0)::int as question_count
from public.exams e
left join public.mcq_exams me on me.exam_id = e.id
group by e.id, e.slug, e.name, e.name_ur, e.sort;

create or replace view public.book_catalog as
select b.id, b.title, coalesce(count(m.id), 0)::int as question_count
from public.books b
left join public.mcqs m on m.book_id = b.id
group by b.id, b.title;

grant select on public.subject_catalog, public.exam_catalog, public.book_catalog
  to anon, authenticated;

-- ---------------------------------------------------------------- question RPCs

create or replace function public.random_questions(p_kind text, p_key text, p_limit int)
returns table (
  id uuid, question_en text, question_ur text,
  options jsonb, correct_text text, explanation text
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.question_en, m.question_ur, m.options, m.correct_text, m.explanation
  from public.mcqs m
  where case p_kind
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
    when 'book' then m.book_id = p_key::uuid
    else false
  end
  order by random()
  limit greatest(1, least(coalesce(p_limit, 10), 500));
$$;

create or replace function public.daily_questions(p_seed text, p_limit int default 10)
returns table (
  id uuid, question_en text, question_ur text,
  options jsonb, correct_text text, explanation text
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.question_en, m.question_ur, m.options, m.correct_text, m.explanation
  from public.mcqs m
  order by md5(m.id::text || coalesce(p_seed, ''))
  limit greatest(1, least(coalesce(p_limit, 10), 500));
$$;

create or replace function public.questions_by_ids(p_ids uuid[])
returns table (
  id uuid, question_en text, question_ur text,
  options jsonb, correct_text text, explanation text
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.question_en, m.question_ur, m.options, m.correct_text, m.explanation
  from public.mcqs m
  where m.id = any (coalesce(p_ids, '{}'::uuid[]));
$$;

grant execute on function public.random_questions(text, text, int) to anon, authenticated;
grant execute on function public.daily_questions(text, int) to anon, authenticated;
grant execute on function public.questions_by_ids(uuid[]) to anon, authenticated;

-- ---------------------------------------------------------------- JSON book import (one transaction)

create or replace function public.import_book(p_book jsonb, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text := nullif(btrim(p_book->>'title'), '');
  v_subject_key text := nullif(btrim(p_book->>'subject'), '');
  v_category text;
  v_book_id uuid;
  v_subject_id uuid;
  v_category_id uuid;
  v_exam_id uuid;
  v_exam_key text;
  v_new_id uuid;
  v_row jsonb;
  v_imported int := 0;
  v_skipped int := 0;
  v_invalid int := 0;
begin
  if v_title is null then
    raise exception 'Book title is required';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'No rows to import';
  end if;

  insert into public.books (title) values (v_title) on conflict (title) do nothing;
  select id into v_book_id from public.books where title = v_title;

  if v_subject_key is not null then
    select id into v_subject_id
    from public.subjects
    where slug = v_subject_key
       or lower(name) = lower(v_subject_key)
       or name_ur = v_subject_key
    limit 1;
  end if;

  v_category := coalesce(nullif(btrim(p_book->>'category'), ''), v_subject_key, 'General');
  insert into public.categories (book_id, name) values (v_book_id, v_category)
    on conflict (book_id, name) do nothing;
  select id into v_category_id
  from public.categories
  where book_id = v_book_id and name = v_category;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    if coalesce(btrim(v_row->>'question_en'), '') = '' or coalesce(btrim(v_row->>'correct_text'), '') = '' then
      v_invalid := v_invalid + 1;
      continue;
    end if;

    v_new_id := null;
    insert into public.mcqs (book_id, category_id, question_en, question_ur, options, correct_text, explanation, source_ref)
    values (
      v_book_id,
      v_category_id,
      btrim(v_row->>'question_en'),
      nullif(btrim(coalesce(v_row->>'question_ur', '')), ''),
      coalesce(v_row->'options', '{}'::jsonb),
      btrim(v_row->>'correct_text'),
      nullif(btrim(coalesce(v_row->>'explanation', '')), ''),
      nullif(btrim(coalesce(v_row->>'source_ref', '')), '')
    )
    on conflict (content_hash) do nothing
    returning id into v_new_id;

    if v_new_id is null then
      v_skipped := v_skipped + 1;
    else
      v_imported := v_imported + 1;
      if v_subject_id is not null then
        insert into public.mcq_subjects (mcq_id, subject_id)
        values (v_new_id, v_subject_id)
        on conflict do nothing;
      end if;
      for v_exam_key in
        select value from jsonb_array_elements_text(coalesce(v_row->'exams', p_book->'exams', '[]'::jsonb))
      loop
        select id into v_exam_id
        from public.exams
        where slug = v_exam_key or lower(name) = lower(v_exam_key)
        limit 1;
        if v_exam_id is not null then
          insert into public.mcq_exams (mcq_id, exam_id)
          values (v_new_id, v_exam_id)
          on conflict do nothing;
        end if;
      end loop;
    end if;
  end loop;

  return jsonb_build_object(
    'book_id', v_book_id,
    'imported', v_imported,
    'skipped', v_skipped,
    'invalid', v_invalid
  );
end;
$$;

revoke all on function public.import_book(jsonb, jsonb) from public;
revoke all on function public.import_book(jsonb, jsonb) from anon, authenticated;
grant execute on function public.import_book(jsonb, jsonb) to service_role;
