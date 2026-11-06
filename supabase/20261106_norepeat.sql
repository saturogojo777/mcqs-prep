-- DailyTest STEP 4B: no repeated questions for the same user (no login).
--
-- The browser keeps seen question ids in localStorage and sends the newest
-- ones (oldest-first, wrong answers ahead) as p_exclude_ids. random_questions
-- serves unseen pool questions first (shuffled), then fills any shortfall
-- from the exclude list in the given order. needs_review rows are never
-- served, and subject/exam/difficulty/level filters behave exactly as before.
-- Plus two helpers: pool_seen_stats ("X new for you of Y") and
-- pool_question_ids ("start a fresh round"), and subject_seen_counts for the
-- Progress page. Idempotent.

drop function if exists public.random_questions(text, text, int, text, text);

create or replace function public.random_questions(
  p_kind text,
  p_key text,
  p_limit int,
  p_difficulty text default null,
  p_level text default null,
  p_exclude_ids uuid[] default '{}'
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
  with pool as (
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
  ),
  ranked as (
    select p.*,
      case when p.id = any (coalesce(p_exclude_ids, '{}'::uuid[])) then 1 else 0 end as seen_rank,
      coalesce(array_position(p_exclude_ids, p.id), 0) as fallback_rank
    from pool p
  )
  select r.id, r.question_en, r.question_ur, r.options, r.correct_text, r.explanation,
         r.chapter, r.subject_slug, r.level, r.difficulty
  from ranked r
  order by r.seen_rank asc,
           case when r.seen_rank = 0 then random() end asc,
           r.fallback_rank asc
  limit greatest(1, least(coalesce(p_limit, 10), 500));
$$;

-- Pool size + unseen count inside the chosen filters ("X new for you of Y").
create or replace function public.pool_seen_stats(
  p_kind text,
  p_key text,
  p_difficulty text default null,
  p_level text default null,
  p_exclude_ids uuid[] default '{}'
)
returns table (total int, unseen int)
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int as total,
         count(*) filter (
           where not (m.id = any (coalesce(p_exclude_ids, '{}'::uuid[])))
         )::int as unseen
  from public.mcqs m
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
    end;
$$;

-- Every live id in a pool (no difficulty/level filter): "start a fresh round"
-- deletes exactly these from the browser's seen map.
create or replace function public.pool_question_ids(
  p_kind text,
  p_key text
)
returns table (id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select m.id
  from public.mcqs m
  where m.review_status <> 'needs_review'
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
    end;
$$;

-- "Seen N of M" per subject: how many of the browser's seen ids sit in each.
create or replace function public.subject_seen_counts(
  p_exclude_ids uuid[] default '{}'
)
returns table (subject_slug text, seen_count int)
language sql
stable
security definer
set search_path = public
as $$
  select s.slug as subject_slug, count(distinct m.id)::int as seen_count
  from public.mcqs m
  join public.mcq_subjects ms on ms.mcq_id = m.id
  join public.subjects s on s.id = ms.subject_id
  where m.id = any (coalesce(p_exclude_ids, '{}'::uuid[]))
  group by s.slug;
$$;

grant execute on function public.random_questions(text, text, int, text, text, uuid[]) to anon, authenticated;
grant execute on function public.pool_seen_stats(text, text, text, text, uuid[]) to anon, authenticated;
grant execute on function public.pool_question_ids(text, text) to anon, authenticated;
grant execute on function public.subject_seen_counts(uuid[]) to anon, authenticated;
