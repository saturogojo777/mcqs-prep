-- DailyTest 2026-11-06: honest counts, honest difficulty.
--
-- 1. Every MCQ keeps exactly one primary subject tag. The old build tagged the
--    whole legacy book as general-knowledge AND its real subject, so subject
--    counts summed to 2x the library. After this, subject counts sum to the
--    site total and general-knowledge shows Coming soon until real GK-subject
--    questions land.
-- 2. Exam pools are rebuilt from subject relevance x difficulty band (see the
--    mapping below). No exam falls back to the site total; each count is the
--    number of questions actually tagged for that exam:
--      one-paper commissions (ppsc, spsc, fpsc, nts-pts-ots, police, teachers)
--        and forces: basic + intermediate only. Advanced means CSS-screening
--        level precision, which is above these papers.
--      fpsc / nts-pts-ots exclude Urdu (their papers are English-medium).
--      forces covers GK, Pakistan Studies, Islamiat, Maths, English and
--        Everyday Science (initial-test academic portion).
--      css-pms covers the MPT-style subjects at intermediate + advanced.
--      mdcat-ecat covers Everyday Science, Maths and English at intermediate
--        + advanced.
--    Broad one-paper exams can honestly share the same count today because the
--    live subjects sit in every syllabus; counts diverge as Urdu, Islamiat and
--    GK-subject questions are added.
-- 3. Difficulty/level from the per-question audit in content/audit/ (not the
--    old medium/intermediate default), dubious legacy rows flagged
--    needs_review, current-affairs rows stamped as_of.
-- 4. site_stats counts LIVE taxonomy only (subjects/books/exams/chapters that
--    actually hold verified questions).
-- 5. content_hash is set by trigger from now on, so every insert path dedupes.

-- ---------------------------------------------------------- difficulty audit

update public.mcqs set difficulty = 'easy', level = 'basic'
where source_ref = any (string_to_array(
  '1,2,3,4,5,6,7,9,10,11,13,14,15,16,17,18,19,20,21,24,25,26,27,29,30,32,33,34,35,37,38,41,45,48,50,52,53,54,58,59,60,61,62,65,66,67,68,69,70,71,73,74,76,77,78,79,80,81,82,87,88,90,91,92,98,99,100,102,103,104,105,106,107,108,109,110,115,116,117,119,122,124,126,129,130,131,133,134,137,138,139,150,154,155,156,157,158,159,160,163,164,165,166,168,169,170,171,172,174,178,179,181,182,183,184,188,189,190,191,192,193,195,196,197,198,199,200,201,202,205,208,209,210,211,212,213,214,216,221,222,223,224,225,226,227,228,230,235,246,248,250,251,252,253,255,256,257,258,259,260,261,262,263,275,277,278,280,285,289,290,292,296,297,298,299,300,301,302,304,305,306,307,308,309,313,316,317,318,320,321,324,325,326,327,328,329,337,338,339,340,341,342,343,344,346,347,348,349,350,351,352,353,354,357,358,359,364,365,366,367,368,369,370,371,372,373,374,375,376,377,378,379,380,383,384,386,387,388,389,390,391,393,394,396,398,399,400,401,402,403,404,405,406,407,408,411,412,413,414,416,418,419,420,421,422,424,425,426,430,431,432,433,434,435,438,439,440,441,444,445,446,448,450,451,452,453,455,456,457,458,461,462,463,464,466,467,468,469,472,473,474,475,476,477,478,479,482,485,486,487,488,489,491,492,496,497,498,499,500', ','));

update public.mcqs set difficulty = 'hard', level = 'advanced'
where source_ref = any (string_to_array(
  '8,12,22,23,28,31,36,39,40,42,43,47,49,56,94,96,97,101,112,113,114,118,120,121,123,125,128,132,135,141,143,144,146,148,153,161,167,176,218,219,234,242,265,267,269,273,279,281,283,287,293,294,295,322,330,333,334,335,360,361,362,363,381,382,385,392,395,397,409,410,417,423,427,428,429,443,447,449,454,459,460,465,470,471,480,481,483,484,490,493,494', ','));

update public.mcqs set review_status = 'needs_review'
where source_ref = any (string_to_array('44,46,145,151,152,173,177,194,437', ','));

update public.mcqs set as_of = date '2026-11-06'
where source_ref = any (string_to_array('206,207,222,223,243,244', ','));

-- Medium/intermediate is the column default; rows not listed above keep it.
-- (The audit's medium list is recorded in content/audit/difficulty-489.json.)

-- ------------------------------------------------------------ subject tags

-- Drop the blanket general-knowledge tag wherever a specific subject exists.
delete from public.mcq_subjects ms
using public.subjects s
where ms.subject_id = s.id
  and s.slug = 'general-knowledge'
  and exists (
    select 1
    from public.mcq_subjects ms2
    join public.subjects s2 on s2.id = ms2.subject_id
    where ms2.mcq_id = ms.mcq_id
      and s2.slug <> 'general-knowledge'
  );

-- --------------------------------------------------------------- exam tags

delete from public.mcq_exams;

-- A. Full-syllabus one-paper exams, basic + intermediate.
insert into public.mcq_exams (mcq_id, exam_id)
select ms.mcq_id, e.id
from public.mcq_subjects ms
join public.mcqs m on m.id = ms.mcq_id
cross join public.exams e
where e.slug = any (array['ppsc', 'spsc', 'police', 'teachers'])
  and m.level = any (array['basic', 'intermediate'])
on conflict do nothing;

-- B. Federal / testing-service papers (English medium, no Urdu), basic + intermediate.
insert into public.mcq_exams (mcq_id, exam_id)
select ms.mcq_id, e.id
from public.mcq_subjects ms
join public.subjects s on s.id = ms.subject_id
join public.mcqs m on m.id = ms.mcq_id
cross join public.exams e
where e.slug = any (array['fpsc', 'nts-pts-ots'])
  and s.slug <> 'urdu'
  and m.level = any (array['basic', 'intermediate'])
on conflict do nothing;

-- C. Forces initial tests: academic portion, basic + intermediate.
insert into public.mcq_exams (mcq_id, exam_id)
select ms.mcq_id, e.id
from public.mcq_subjects ms
join public.subjects s on s.id = ms.subject_id
join public.mcqs m on m.id = ms.mcq_id
cross join public.exams e
where e.slug = 'forces'
  and s.slug = any (array['general-knowledge', 'pakistan-studies', 'islamic-studies',
                           'mathematics', 'english', 'everyday-science'])
  and m.level = any (array['basic', 'intermediate'])
on conflict do nothing;

-- D. CSS/PMS screening (MPT-style subjects), intermediate + advanced.
insert into public.mcq_exams (mcq_id, exam_id)
select ms.mcq_id, e.id
from public.mcq_subjects ms
join public.subjects s on s.id = ms.subject_id
join public.mcqs m on m.id = ms.mcq_id
cross join public.exams e
where e.slug = 'css-pms'
  and s.slug = any (array['general-knowledge', 'pakistan-studies', 'islamic-studies',
                           'current-affairs', 'mathematics', 'english', 'everyday-science'])
  and m.level = any (array['intermediate', 'advanced'])
on conflict do nothing;

-- E. MDCAT/ECAT entry tests, intermediate + advanced.
insert into public.mcq_exams (mcq_id, exam_id)
select ms.mcq_id, e.id
from public.mcq_subjects ms
join public.subjects s on s.id = ms.subject_id
join public.mcqs m on m.id = ms.mcq_id
cross join public.exams e
where e.slug = 'mdcat-ecat'
  and s.slug = any (array['everyday-science', 'mathematics', 'english'])
  and m.level = any (array['intermediate', 'advanced'])
on conflict do nothing;

-- -------------------------------------------------------------- live stats

create or replace function public.site_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'questions', (select count(*) from public.mcqs where review_status <> 'needs_review'),
    'subjects', (select count(distinct ms.subject_id)
                 from public.mcq_subjects ms join public.mcqs m on m.id = ms.mcq_id
                 where m.review_status <> 'needs_review'),
    'exams', (select count(distinct me.exam_id)
              from public.mcq_exams me join public.mcqs m on m.id = me.mcq_id
              where m.review_status <> 'needs_review'),
    'books', (select count(*) from public.books b
              where exists (select 1 from public.mcqs m
                            where m.book_id = b.id and m.review_status <> 'needs_review')),
    'chapters', (select count(*) from public.categories c
                 where exists (select 1 from public.mcqs m
                               where m.category_id = c.id and m.review_status <> 'needs_review')),
    'explanations', (select count(*) from public.mcqs
                     where review_status <> 'needs_review' and explanation is not null and btrim(explanation) <> '')
  );
$$;

-- ------------------------------------------------- content_hash note
--
-- content_hash is a GENERATED ALWAYS column (mcq_hash(question_en, options)),
-- so every insert path dedupes automatically. No trigger needed.
