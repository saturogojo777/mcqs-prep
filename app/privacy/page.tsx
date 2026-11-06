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
        DailyTest does not have accounts and does not ask for your name or email to practise. Your language choice, your
        list of wrong answers and the questions you have already seen are saved in your own browser using{' '}
        <strong>localStorage</strong>. That data never leaves your device and you can clear it at any time from your
        browser settings or the Progress page.
      </p>
      <h2>Cookies</h2>
      <p>
        The site itself does not set tracking cookies. If advertising is enabled in the future, our advertising partners
        may set cookies or use similar technologies to show relevant ads.
      </p>
      <h2>Advertising</h2>
      <p>
        Currently no ads are shown. If we enable Google AdSense in the future, Google and partners may use cookies to
        serve ads based on your prior visits to this website or other websites. Google&apos;s use of advertising cookies
        enables it and its partners to serve ads to you based on your visit to this site and/or other sites on the
        Internet. You can opt out of personalised advertising by visiting Google&apos;s Ads Settings.
      </p>
      <h2>Contact form</h2>
      <p>
        If you send a message through the contact form, we store your name, email address and message so that we can
        reply. We do not sell or share that information.
      </p>
      <h2>How long we keep messages</h2>
      <p>
        Contact messages are kept for up to 12 months so that we can follow up on corrections and suggestions, then
        deleted. Write to us at the address below if you want your message removed sooner.
      </p>
      <h2>Children&apos;s data</h2>
      <p>
        DailyTest is a general study site and does not knowingly collect data from children. If you are under 13, please
        do not use the contact form; ask a parent or teacher to write to us instead.
      </p>
      <h2>Analytics</h2>
      <p>We do not run any third-party analytics or tracking scripts on this site.</p>
      <h2>Questions</h2>
      <p>
        Write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> for anything about this policy.
      </p>
      <p className="legal-updated">Last updated: 6 November 2026.</p>
    </LegalPage>
  )
}
