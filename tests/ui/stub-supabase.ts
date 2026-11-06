// Test double for the browser Supabase client (used only by the UI harness).
// It mirrors the RPCs the app calls, nothing else.

export type Row = {
  id: string
  question_en: string
  question_ur: string | null
  options: Record<string, string>
  correct_text: string
  explanation: string | null
  source_ref: string | null
  chapter: string | null
  subject_slug: string | null
  level: 'basic' | 'intermediate' | 'advanced'
  difficulty: 'easy' | 'medium' | 'hard'
}

export const SUBJECT = 'general-knowledge'

const gk: [string, string, string, string[]][] = [
  ['Who is the founder of Pakistan?', 'پاکستان کے بانی کون ہیں؟', 'Muhammad Ali Jinnah', ['Allama Iqbal', 'Liaquat Ali Khan', 'Muhammad Ali Jinnah', 'Ayub Khan']],
  ['When did Pakistan come into existence?', 'پاکستان کب وجود میں آیا؟', '14 August 1947', ['14 August 1947', '15 August 1947', '23 March 1940', '25 December 1947']],
  ['What is the capital of Pakistan?', 'پاکستان کا دارالحکومت کیا ہے؟', 'Islamabad', ['Karachi', 'Lahore', 'Islamabad', 'Peshawar']],
  ['What is the national language of Pakistan?', 'قومی زبان کون سی ہے؟', 'Urdu', ['Punjabi', 'Sindhi', 'Urdu', 'Pashto']],
  ['What is the national animal of Pakistan?', 'قومی جانور کون سا ہے؟', 'Markhor', ['Markhor', 'Lion', 'Tiger', 'Deer']],
  ['What is the national bird of Pakistan?', 'قومی پرندہ کون سا ہے؟', 'Chukar', ['Eagle', 'Chukar', 'Dove', 'Peacock']],
  ['What is the national flower of Pakistan?', 'قومی پھول کون سا ہے؟', 'Jasmine', ['Rose', 'Jasmine', 'Tulip', 'Lily']],
  ['What is the national sport of Pakistan?', 'قومی کھیل کون سا ہے؟', 'Hockey', ['Cricket', 'Hockey', 'Squash', 'Kabaddi']],
  ['Which mountain is the highest in Pakistan?', 'سب سے اونچا پہاڑ کون سا ہے؟', 'K2', ['Nanga Parbat', 'K2', 'Rakaposhi', 'Broad Peak']],
  ['How many provinces does Pakistan have?', 'پاکستان میں کتنے صوبے ہیں؟', '4', ['3', '4', '5', '6']],
  ['Who was the first Prime Minister of Pakistan?', 'پہلے وزیراعظم کون تھے؟', 'Liaquat Ali Khan', ['Liaquat Ali Khan', 'Khawaja Nazimuddin', 'Feroz Khan Noon', 'Zulfikar Ali Bhutto']],
  ['In which year did Pakistan become a republic?', 'پاکستان کب جمہوریہ بنا؟', '1956', ['1947', '1956', '1962', '1973']],
]

export const QUESTIONS: Row[] = gk.map(([en, ur, correct, options], index) => {
  const optionsObject: Record<string, string> = {}
  ;['A', 'B', 'C', 'D'].forEach((key, i) => {
    optionsObject[key] = options[i]
  })
  return {
    id: `q-${index + 1}`,
    question_en: en,
    question_ur: ur,
    options: optionsObject,
    correct_text: correct,
    explanation: null,
    source_ref: String(index + 1),
    chapter: 'Pakistan GK',
    subject_slug: SUBJECT,
    level: 'intermediate',
    difficulty: 'medium',
  }
})

export const QUESTION_COUNT = QUESTIONS.length

const excludeList = (params: Record<string, unknown>): string[] =>
  Array.isArray(params.p_exclude_ids) ? (params.p_exclude_ids as unknown[]).map(String) : []

/** Deterministic mirror of the server rule: unseen first, then the exclude list in order. */
function randomQuestions(_kind: string, _key: string, limit: number, excluded: string[]): Row[] {
  const order = new Map(excluded.map((id, index) => [id, index]))
  const ranked = [
    ...QUESTIONS.filter((row) => !order.has(row.id)),
    ...QUESTIONS.filter((row) => order.has(row.id)).sort(
      (a, b) => order.get(a.id)! - order.get(b.id)!,
    ),
  ]
  return ranked.slice(0, Math.max(1, Math.min(limit, QUESTIONS.length)))
}

export function getSupabase() {
  return {
    rpc(name: string, params: Record<string, unknown>) {
      if (name === 'random_questions') {
        return Promise.resolve({
          data: randomQuestions(
            String(params.p_kind),
            String(params.p_key),
            Number(params.p_limit),
            excludeList(params),
          ),
          error: null,
        })
      }
      if (name === 'pool_seen_stats') {
        const excluded = new Set(excludeList(params))
        return Promise.resolve({
          data: [{ total: QUESTIONS.length, unseen: QUESTIONS.filter((row) => !excluded.has(row.id)).length }],
          error: null,
        })
      }
      if (name === 'pool_question_ids') {
        return Promise.resolve({ data: QUESTIONS.map((row) => ({ id: row.id })), error: null })
      }
      if (name === 'subject_seen_counts') {
        const excluded = new Set(excludeList(params))
        return Promise.resolve({
          data: [
            {
              subject_slug: SUBJECT,
              seen_count: QUESTIONS.filter((row) => excluded.has(row.id)).length,
            },
          ],
          error: null,
        })
      }
      if (name === 'daily_questions') {
        return Promise.resolve({
          data: QUESTIONS.slice(0, Number(params.p_limit) || 10),
          error: null,
        })
      }
      if (name === 'questions_by_ids') {
        const ids = (params.p_ids as string[]) ?? []
        return Promise.resolve({
          data: QUESTIONS.filter((row) => ids.includes(row.id)),
          error: null,
        })
      }
      return Promise.resolve({ data: null, error: { message: `unknown rpc ${name}` } })
    },
    from() {
      return {
        select: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
        }),
      }
    },
  }
}

export function correctFor(questionEn: string): string {
  return QUESTIONS.find((row) => row.question_en === questionEn)!.correct_text
}
