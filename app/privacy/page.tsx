import type { Metadata } from 'next'
import LegalPage from '@/components/LegalPage'
import { CONTACT_EMAIL, absolute } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How DailyTest handles data: local storage, cookies and third-party advertising.',
  alternates: { canonical: absolute('/privacy') },
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" titleUr="پرائیویسی پالیسی">
      <h2>What we store</h2>
      <p>
        DailyTest does not have accounts and does not ask for your name or email to practise. Your language choice and
        your list of wrong answers are saved in your own browser using <strong>localStorage</strong>. That data never
        leaves your device and you can clear it at any time from your browser settings.
      </p>
      <h2>Cookies</h2>
      <p>
        The site itself does not set tracking cookies. If advertising is enabled in the future, our advertising partners
        may set cookies or use similar technologies to show relevant ads.
      </p>
      <h2>Google AdSense and third-party advertising</h2>
      <p>
        We may use Google AdSense to show ads. Third-party vendors, including Google, use cookies to serve ads based on
        your prior visits to this website or other websites. Google&apos;s use of advertising cookies enables it and its
        partners to serve ads to you based on your visit to this site and/or other sites on the Internet. You can opt out
        of personalised advertising by visiting Google&apos;s Ads Settings.
      </p>
      <h2>Contact form</h2>
      <p>
        If you send a message through the contact form, we store your name, email address and message so that we can
        reply. We do not sell or share that information.
      </p>
      <h2>Analytics</h2>
      <p>We do not run any third-party analytics or tracking scripts on this site.</p>
      <h2>Questions</h2>
      <p>
        Write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> for anything about this policy.
      </p>
    </LegalPage>
  )
}
