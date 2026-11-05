import type { Metadata } from 'next'
import PracticeFlow from '@/components/PracticeFlow'
import { absolute } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Practice my mistakes',
  description: 'Practise again the questions you answered wrongly last time.',
  alternates: { canonical: absolute('/mistakes') },
  robots: { index: false, follow: true },
}

export default function MistakesPage() {
  return (
    <PracticeFlow
      mode="mistakes"
      title="Practice my mistakes"
      titleUr="اپنی غلطیاں دہرائیں"
      itemKey="mistakes"
      available={0}
      autoStart
    />
  )
}
