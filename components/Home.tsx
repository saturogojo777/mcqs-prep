import Link from 'next/link'
import { T } from '@/components/text'
import { IconArrow, IconBook, IconCalendar, IconExam, IconSubject } from '@/components/icons'

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

export default function Home() {
  return (
    <div className="container home">
      <section className="hero">
        <h1 className="hero-title">
          <T en="Daily practice for Pakistan's exams" ur="پاکستان کے امتحانات کے لیے روزانہ کی مشق" />
        </h1>
        <p className="hero-sub">
          <T
            en="Pick an exam, a subject or a book, choose how many questions, and start. No sign-up."
            ur="امتحان، مضمون یا کتاب چنیں، سوالات کی تعداد مقرر کریں اور شروع کریں۔ اکاؤنٹ کی ضرورت نہیں۔"
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
            <T
              en="10 questions, same for everyone today"
              ur="دس سوالات، آج سب کے لیے ایک جیسے"
            />
          </span>
        </span>
        <span className="choice-arrow" aria-hidden="true">
          <IconArrow size={18} />
        </span>
      </Link>
    </div>
  )
}
