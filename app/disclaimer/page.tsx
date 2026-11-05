import type { Metadata } from 'next'
import LegalPage from '@/components/LegalPage'
import { absolute } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Disclaimer',
  description: 'DailyTest is practice material only and is not affiliated with any examination commission.',
  alternates: { canonical: absolute('/disclaimer') },
}

export default function DisclaimerPage() {
  return (
    <LegalPage title="Disclaimer" titleUr="دستبرداری">
      <p>
        DailyTest is practice material only. It is not an official website and it is not affiliated with, endorsed by, or
        connected to PPSC, FPSC, SPSC, NTS, PTS, OTS, CSS/PMS, MDCAT/ECAT or any other commission or testing body.
      </p>
      <p>
        Every answer on this site may contain errors. Questions are collected for revision and may become out of date.
        Nothing here is a guarantee of any exam result, and nothing here is legal or official advice.
      </p>
      <p>
        Always verify dates, figures, rules and syllabus details with the official advertisement and the official
        department before you rely on them.
      </p>
    </LegalPage>
  )
}
