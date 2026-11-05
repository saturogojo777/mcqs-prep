import type { Metadata } from 'next'
import LegalPage from '@/components/LegalPage'
import { CONTACT_EMAIL, absolute } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'The simple terms for using DailyTest.',
  alternates: { canonical: absolute('/terms') },
}

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" titleUr="شرائطِ استعمال">
      <p>
        By using DailyTest you agree to these terms. They are short on purpose.
      </p>
      <h2>Use of the site</h2>
      <p>
        DailyTest is free for personal study. You may not copy the whole question bank, resell it, or use the site in a
        way that damages it or other people&apos;s use of it.
      </p>
      <h2>Content and accuracy</h2>
      <p>
        The questions are practice material written for revision. We try to keep answers correct, but mistakes happen.
        Always check anything important against the official advertisement, syllabus or textbook. See our Disclaimer.
      </p>
      <h2>No warranty</h2>
      <p>
        The site is provided &quot;as is&quot;. We do not promise that it will always be available, error free, or that
        using it will get you a particular result in any exam.
      </p>
      <h2>Changes</h2>
      <p>
        We may add, change or remove content at any time. If these terms change, the new version will appear on this page.
      </p>
      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  )
}
