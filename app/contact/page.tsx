import type { Metadata } from 'next'
import ContactForm from '@/components/ContactForm'
import { T } from '@/components/text'
import { CONTACT_EMAIL, absolute } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Contact DailyTest',
  description: 'Send a question, a correction or a suggestion to DailyTest.',
  alternates: { canonical: absolute('/contact') },
}

export default function ContactPage() {
  return (
    <div className="container page page--narrow">
      <header className="page-head">
        <h1 className="page-title">
          <T en="Contact" ur="رابطہ" />
        </h1>
        <p className="page-sub">
          <T
            en="Found a wrong answer, or want to add your own questions? Send a message."
            ur="کوئی جواب غلط ملا، یا اپنے سوالات شامل کرنا چاہتے ہیں؟ پیغام بھیجیں۔"
          />
        </p>
      </header>

      <p className="contact-email">
        <T en="Email:" ur="ای میل:" /> <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>

      <ContactForm />
    </div>
  )
}
