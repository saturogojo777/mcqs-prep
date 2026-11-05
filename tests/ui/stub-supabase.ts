// Test double for the browser Supabase client (used only by the UI harness).

export type CatalogRow = {
  book_id: string
  title: string
  category_id: string | null
  category_name: string | null
  question_count: number
}

type Row = {
  id: string
  question_en: string
  question_ur: string | null
  options: Record<string, string>
  correct_text: string
  explanation: string | null
  source_ref: string | null
  category_id: string
}

const BOOK = 'b0000000-0000-0000-0000-000000000001'
const GK = 'c0000000-0000-0000-0000-000000000001'
const SCI = 'c0000000-0000-0000-0000-000000000002'

export const CATEGORIES = { GK, SCI }

export const CATALOG: CatalogRow[] = [
  {
    book_id: BOOK,
    title: 'General Knowledge (500 Questions)',
    category_id: GK,
    category_name: 'Pakistan GK & Constitution',
    question_count: 12,
  },
  {
    book_id: BOOK,
    title: 'General Knowledge (500 Questions)',
    category_id: SCI,
    category_name: 'Science & Computer',
    question_count: 3,
  },
]

const gk: [string, string, string, string[], number][] = [
  ['Who is the founder of Pakistan?', 'پاکستان کے بانی کون ہیں؟', 'Muhammad Ali Jinnah', ['Allama Iqbal', 'Liaquat Ali Khan', 'Muhammad Ali Jinnah', 'Ayub Khan'], 2],
  ['When did Pakistan come into existence?', 'پاکستان کب وجود میں آیا؟', '14 August 1947', ['14 August 1947', '15 August 1947', '23 March 1940', '25 December 1947'], 0],
  ['What is the capital of Pakistan?', 'پاکستان کا دارالحکومت کیا ہے؟', 'Islamabad', ['Karachi', 'Lahore', 'Islamabad', 'Peshawar'], 2],
  ['What is the national language of Pakistan?', 'قومی زبان کون سی ہے؟', 'Urdu', ['Punjabi', 'Sindhi', 'Urdu', 'Pashto'], 2],
  ['What is the national animal of Pakistan?', 'قومی جانور کون سا ہے؟', 'Markhor', ['Markhor', 'Lion', 'Tiger', 'Deer'], 0],
  ['What is the national bird of Pakistan?', 'قومی پرندہ کون سا ہے؟', 'Chukar', ['Eagle', 'Chukar', 'Dove', 'Peacock'], 1],
  ['What is the national flower of Pakistan?', 'قومی پھول کون سا ہے؟', 'Jasmine', ['Rose', 'Jasmine', 'Tulip', 'Lily'], 1],
  ['What is the national sport of Pakistan?', 'قومی کھیل کون سا ہے؟', 'Hockey', ['Cricket', 'Hockey', 'Squash', 'Kabaddi'], 1],
  ['Which mountain is the highest in Pakistan?', 'سب سے اونچا پہاڑ کون سا ہے؟', 'K2', ['Nanga Parbat', 'K2', 'Rakaposhi', 'Broad Peak'], 1],
  ['How many provinces does Pakistan have?', 'پاکستان میں کتنے صوبے ہیں؟', '4', ['3', '4', '5', '6'], 1],
  ['Who was the first Prime Minister of Pakistan?', 'پہلے وزیراعظم کون تھے؟', 'Liaquat Ali Khan', ['Liaquat Ali Khan', 'Khawaja Nazimuddin', 'Feroz Khan Noon', 'Zulfikar Ali Bhutto'], 0],
  ['In which year did Pakistan become a republic?', 'پاکستان کب جمہوریہ بنا؟', '1956', ['1947', '1956', '1962', '1973'], 1],
]

const science: [string, string, string, string[], number][] = [
  ['Water is made of which two gases?', 'پانی کن دو گیسوں سے بنتا ہے؟', 'Hydrogen and oxygen', ['Oxygen and nitrogen', 'Hydrogen and oxygen', 'Carbon and oxygen', 'Helium and neon'], 1],
  ['What is the chemical symbol for gold?', 'سونا کی علامت کیا ہے؟', 'Au', ['Ag', 'Au', 'Gd', 'Go'], 1],
  ['How many bits are in one byte?', 'ایک بائٹ میں کتنے بٹ ہوتے ہیں؟', '8', ['4', '8', '16', '32'], 1],
]

function rowsFor(categoryId: string, list: typeof gk): Row[] {
  return list.map(([en, ur, correct, options, start], index) => {
    const optionsObject: Record<string, string> = {}
    ;['A', 'B', 'C', 'D'].forEach((key, i) => {
      optionsObject[key] = options[(start + i) % 4]
    })
    return {
      id: `${categoryId}-${index}`,
      question_en: en,
      question_ur: ur,
      options: optionsObject,
      correct_text: correct,
      explanation: null,
      source_ref: String(index + 1),
      category_id: categoryId,
    }
  })
}

export const QUESTIONS: Row[] = [
  ...rowsFor(GK, gk),
  ...rowsFor(SCI, science as unknown as typeof gk),
]

export function questionsFor(categoryId: string): Row[] {
  return QUESTIONS.filter((q) => q.category_id === categoryId)
}

function chain(result: { data: unknown; error: null }) {
  const promise = Promise.resolve(result)
  const self: Record<string, unknown> = {
    select: () => self,
    eq: () => self,
    then: (resolve: unknown, reject: unknown) =>
      (promise as Promise<unknown>).then(resolve as never, reject as never),
    catch: (reject: unknown) => promise.catch(reject as never),
  }
  return self
}

export function getSupabase() {
  return {
    from(table: string) {
      if (table === 'catalog') return chain({ data: CATALOG, error: null })
      return {
        select: () => ({
          eq: (_column: string, value: string) =>
            chain({ data: questionsFor(value), error: null }),
        }),
      }
    },
  }
}
