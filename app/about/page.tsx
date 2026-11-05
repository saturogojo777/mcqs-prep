import type { Metadata } from 'next'
import LegalPage from '@/components/LegalPage'
import { CONTACT_EMAIL, OWNER, absolute } from '@/lib/site'

export const metadata: Metadata = {
  title: 'About DailyTest',
  description: 'DailyTest is a free MCQ practice site for Pakistani exams, run by Saturo Gojo in Okara, Punjab, Pakistan.',
  alternates: { canonical: absolute('/about') },
}

export default function AboutPage() {
  return (
    <LegalPage title="About DailyTest" titleUr="ڈیلی ٹیسٹ کے بارے میں">
      <p>
        DailyTest is a small, free practice site for Pakistani competitive exams. You pick an exam, a subject or a book,
        choose how many questions you want, and start. There is no sign-up, no login and no charge.
      </p>
      <p>
        Questions are multiple choice with four options. Options are shuffled every time you see a question, so you learn
        the answer rather than the position of a letter. After each test you get your score, your time, and a list of the
        questions you got wrong with the correct answer.
      </p>
      <p>
        Everything works in English and in Urdu. Your language choice and your list of mistakes are stored in your own
        browser only — we do not have accounts and we do not track you.
      </p>
      <p>
        The site is run by {OWNER}. If you find a wrong answer or want to contribute questions, please write to{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  )
}
