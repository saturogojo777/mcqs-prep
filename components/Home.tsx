import Link from 'next/link'
import { Num, T } from '@/components/text'
import { IconArrow, IconBolt, IconBook, IconCalendar, IconChart, IconExam, IconShield, IconSubject } from '@/components/icons'
import ExamIcon from '@/components/ExamIcon'
import AdSlot from '@/components/site/AdSlot'
import type { Catalog, CatalogItem, SiteStats } from '@/lib/types'

const CHOICES = [
  {
    href: '/exams',
    label: 'Exam',
    labelUr: 'امتحان',
    hint: 'PPSC, CSS, MDCAT, Police…',
    hintUr: 'پی پی ایس سی، سی ایس ایس، ایم ڈی کیٹ، پولیس…',
    Icon: IconExam,
  },
  {
    href: '/subjects',
    label: 'Subject',
    labelUr: 'مضمون',
    hint: 'Pakistan Studies, Maths, Science…',
    hintUr: 'مطالعہ پاکستان، ریاضی، سائنس…',
    Icon: IconSubject,
  },
  {
    href: '/books',
    label: 'Book',
    labelUr: 'کتاب',
    hint: 'Practise a whole book',
    hintUr: 'پوری کتاب کی مشق کریں',
    Icon: IconBook,
  },
]

const STEPS = [
  {
    title: 'Pick your paper',
    titleUr: 'اپنا پرچہ چنیں',
    body: 'Choose an exam, a subject or a whole book.',
    bodyUr: 'امتحان، مضمون یا پوری کتاب چنیں۔',
  },
  {
    title: 'Choose the length',
    titleUr: 'لمبائی مقرر کریں',
    body: '10, 20, 50, 100 or your own number. Practice or Mock Test.',
    bodyUr: 'دس، بیس، پچاس، سو یا اپنی تعداد۔ مشق یا ماک ٹیسٹ۔',
  },
  {
    title: 'Start and review',
    titleUr: 'شروع کریں اور دیکھیں',
    body: 'See the score, the explanations and the topics to work on.',
    bodyUr: 'اسکور، وضاحت اور کمزور موضوعات دیکھیں۔',
  },
]

const WHY = [
  {
    Icon: IconShield,
    title: 'Written for these papers',
    titleUr: 'انہی پرچوں کے لیے لکھا گیا',
    body: 'Original questions built around the official syllabi, not copied from other sites.',
    bodyUr: 'سرکاری نصاب کے مطابق اصل سوالات، کسی اور سائٹ سے نقل نہیں۔',
  },
  {
    Icon: IconChart,
    title: 'Explain every answer',
    titleUr: 'ہر جواب کی وضاحت',
    body: 'A one or two line explanation sits under each answer, in English and Urdu.',
    bodyUr: 'ہر جواب کے نیچے انگریزی اور اردو میں مختصر وضاحت۔',
  },
  {
    Icon: IconBolt,
    title: 'No sign-up, no cost',
    titleUr: 'نہ اکاؤنٹ، نہ فیس',
    body: 'Open a paper and start. Progress stays in your own browser.',
    bodyUr: 'پرچہ کھولیں اور شروع کریں۔ پیش رفت آپ کے براؤزر میں رہتی ہے۔',
  },
  {
    Icon: IconCalendar,
    title: 'A fresh daily test',
    titleUr: 'ہر روز نیا ٹیسٹ',
    body: 'Ten new questions every day, the same set for every visitor.',
    bodyUr: 'ہر روز دس نئے سوالات، ہر وزٹر کے لیے وہی سیٹ۔',
  },
]

const FAQ = [
  {
    q: 'Is DailyTest free?',
    qUr: 'کیا ڈیلی ٹیسٹ مفت ہے؟',
    a: 'Yes. Every question, explanation and mock test is free and needs no account.',
    aUr: 'جی ہاں۔ ہر سوال، وضاحت اور ماک ٹیسٹ مفت ہے اور اکاؤنٹ کی ضرورت نہیں۔',
  },
  {
    q: 'Which exams are covered?',
    qUr: 'کون سے امتحانات شامل ہیں؟',
    a: 'PPSC, FPSC, SPSC, NTS/PTS/OTS, one-paper posts, CSS/PMS screening, Police, Teachers, Forces and MDCAT/ECAT.',
    aUr: 'پی پی ایس سی، ایف پی ایس سی، ایس پی ایس سی، این ٹی ایس، سی ایس ایس، پولیس، اساتذہ، فورسز اور ایم ڈی کیٹ۔',
  },
  {
    q: 'Are these real past-paper questions?',
    qUr: 'کیا یہ اصل پرانے پرچوں کے سوالات ہیں؟',
    a: 'No. All questions are original practice material. We are not affiliated with PPSC, FPSC, NTS or any board, and answers can contain mistakes — tell us when you find one.',
    aUr: 'نہیں۔ تمام سوالات اصل مشقی مواد ہیں۔ ہم کسی بورڈ سے وابستہ نہیں اور جواب میں غلطی ہو سکتی ہے — ہمیں بتائیں۔',
  },
  {
    q: 'What is the difference between Practice and Mock Test?',
    qUr: 'مشق اور ماک ٹیسٹ میں کیا فرق ہے؟',
    a: 'Practice marks each answer as you go and shows the explanation. Mock Test keeps every answer hidden until you submit, with a countdown, question palette and marks like a real paper.',
    aUr: 'مشق میں فوراً جواب اور وضاحت ملتی ہے۔ ماک ٹیسٹ میں جوابات جمع کرنے تک چھپے رہتے ہیں، ساتھ گھڑی، سوالات کی فہرست اور نمبر ہوتے ہیں۔',
  },
  {
    q: 'Do you follow the official test pattern?',
    qUr: 'کیا آپ سرکاری خاکہ اپناتے ہیں؟',
    a: 'The mock-test defaults are our own starting values. Always verify the number of questions, time and negative marking with the official advertisement of your post.',
    aUr: 'ماک ٹیسٹ کے طے شدہ اعداد ہمارے اپنے ہیں۔ سوالات کی تعداد، وقت اور منفی مارکنگ اپنے عہدے کے سرکاری اشتہار سے تصدیق کریں۔',
  },
]

function count(n: number) {
  return new Intl.NumberFormat('en-US').format(n)
}

function ExamCard({ item }: { item: CatalogItem }) {
  return (
    <Link href={`/practice/${item.kind}/${item.key}`} className="tile">
      <span className="tile-icon">
        <ExamIcon slug={item.key} size={18} />
      </span>
      <span className="tile-name">
        {item.nameUr ? <T en={item.name} ur={item.nameUr} /> : item.name}
      </span>
      <span className="tile-meta num">{count(item.count)}</span>
    </Link>
  )
}

export default function Home({ catalog, stats }: { catalog: Catalog; stats: SiteStats }) {
  const exams = catalog.exams.filter((item) => item.count > 0)
  const subjects = catalog.subjects.filter((item) => item.count > 0)
  const books = catalog.books.filter((item) => item.count > 0).sort((a, b) => b.count - a.count)

  const statItems = [
    { value: stats.questions, en: 'questions', ur: 'سوالات' },
    { value: stats.subjects, en: 'subjects', ur: 'مضامین' },
    { value: stats.exams, en: 'exams', ur: 'امتحانات' },
    { value: stats.books, en: 'books', ur: 'کتابیں' },
  ]

  return (
    <div className="container home">
      <section className="hero">
        <h1 className="hero-title">
          <T en="Daily practice for Pakistan's exams" ur="پاکستان کے امتحانات کے لیے روزانہ کی مشق" />
        </h1>
        <p className="hero-sub">
          <T
            en="Pick an exam, a subject or a book, choose how many questions, and start. Free, no sign-up, English and Urdu."
            ur="امتحان، مضمون یا کتاب چنیں، سوالات کی تعداد مقرر کریں اور شروع کریں۔ مفت، بغیر اکاؤنٹ، انگریزی اور اردو۔"
          />
        </p>
      </section>

      <div className="choice-grid">
        {CHOICES.map(({ href, label, labelUr, hint, hintUr, Icon }) => (
          <Link key={href} href={href} className="choice">
            <span className="choice-icon">
              <Icon size={22} />
            </span>
            <span className="choice-text">
              <span className="choice-title">
                <T en={label} ur={labelUr} />
              </span>
              <span className="choice-hint">
                <T en={hint} ur={hintUr} />
              </span>
            </span>
            <span className="choice-arrow" aria-hidden="true">
              <IconArrow size={18} />
            </span>
          </Link>
        ))}
      </div>

      <Link href="/today" className="today-card">
        <span className="today-icon">
          <IconCalendar size={20} />
        </span>
        <span className="today-text">
          <span className="today-title">
            <T en="Today's Test" ur="آج کا ٹیسٹ" />
          </span>
          <span className="today-hint">
            <T en="10 questions, same for everyone today" ur="دس سوالات، آج سب کے لیے ایک جیسے" />
          </span>
        </span>
        <span className="choice-arrow" aria-hidden="true">
          <IconArrow size={18} />
        </span>
      </Link>

      <section className="stats-strip" aria-label="Library size">
        {statItems.map((stat) => (
          <div className="stat" key={stat.en}>
            <span className="stat-value num">{count(stat.value)}</span>
            <span className="stat-label">
              <T en={stat.en} ur={stat.ur} />
            </span>
          </div>
        ))}
      </section>

      {exams.length > 0 && (
        <section className="home-section">
          <div className="section-head">
            <h2 className="section-title">
              <T en="Popular exams" ur="مقبول امتحانات" />
            </h2>
            <Link href="/exams" className="section-link">
              <T en="All exams" ur="تمام امتحانات" /> <IconArrow size={14} />
            </Link>
          </div>
          <div className="tile-grid">
            {exams.slice(0, 9).map((item) => (
              <ExamCard key={item.key} item={item} />
            ))}
          </div>
        </section>
      )}

      {subjects.length > 0 && (
        <section className="home-section">
          <div className="section-head">
            <h2 className="section-title">
              <T en="Subjects" ur="مضامین" />
            </h2>
            <Link href="/subjects" className="section-link">
              <T en="All subjects" ur="تمام مضامین" /> <IconArrow size={14} />
            </Link>
          </div>
          <div className="tile-grid tile-grid--subjects">
            {subjects.slice(0, 8).map((item) => (
              <Link key={item.key} href={`/practice/subject/${item.key}`} className="tile tile--subject">
                <span className="tile-name">
                  {item.nameUr ? <T en={item.name} ur={item.nameUr} /> : item.name}
                </span>
                <span className="tile-meta num">
                  <T en={`${count(item.count)} questions`} ur={`${count(item.count)} سوالات`} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {books.length > 0 && (
        <section className="home-section">
          <div className="section-head">
            <h2 className="section-title">
              <T en="Books" ur="کتابیں" />
            </h2>
            <Link href="/books" className="section-link">
              <T en="All books" ur="تمام کتابیں" /> <IconArrow size={14} />
            </Link>
          </div>
          <div className="book-grid">
            {books.slice(0, 4).map((item) => (
              <Link key={item.key} href={`/practice/book/${item.key}`} className="book-card">
                <span className="book-spine" aria-hidden="true" />
                <span className="book-body">
                  <span className="book-title">
                    {item.nameUr ? <T en={item.name} ur={item.nameUr} /> : item.name}
                  </span>
                  <span className="book-meta">
                    <Num>{count(item.count)}</Num>{' '}
                    <T en="questions" ur="سوالات" />
                    {item.chapters ? (
                      <>
                        {' · '}
                        <Num>{item.chapters}</Num> <T en="chapters" ur="ابواب" />
                      </>
                    ) : null}
                  </span>
                </span>
                <span className="choice-arrow" aria-hidden="true">
                  <IconArrow size={16} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <AdSlot slot="home" />

      <section className="home-section">
        <h2 className="section-title">
          <T en="How it works" ur="طریقہ کار" />
        </h2>
        <ol className="steps">
          {STEPS.map((step, i) => (
            <li className="step" key={step.title}>
              <span className="step-num num">{i + 1}</span>
              <span className="step-title">
                <T en={step.title} ur={step.titleUr} />
              </span>
              <span className="step-body">
                <T en={step.body} ur={step.bodyUr} />
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-section">
        <h2 className="section-title">
          <T en="Why DailyTest" ur="ڈیلی ٹیسٹ کیوں" />
        </h2>
        <div className="why-grid">
          {WHY.map(({ Icon, title, titleUr, body, bodyUr }) => (
            <div className="why" key={title}>
              <span className="why-icon">
                <Icon size={18} />
              </span>
              <span className="why-title">
                <T en={title} ur={titleUr} />
              </span>
              <span className="why-body">
                <T en={body} ur={bodyUr} />
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="home-section home-section--faq">
        <h2 className="section-title">
          <T en="Questions students ask" ur="طلبہ کے عام سوالات" />
        </h2>
        <div className="faq">
          {FAQ.map((entry) => (
            <details className="faq-item" key={entry.q}>
              <summary className="faq-q">
                <T en={entry.q} ur={entry.qUr} />
              </summary>
              <p className="faq-a">
                <T en={entry.a} ur={entry.aUr} />
              </p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}

