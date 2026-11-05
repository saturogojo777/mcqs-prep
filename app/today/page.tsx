import type { Metadata } from 'next'
import PracticeFlow from '@/components/PracticeFlow'
import { todaySeed } from '@/lib/session'
import { absolute } from '@/lib/site'

export const metadata: Metadata = {
  title: "Today's Test — 10 new questions, the same for everyone today",
  description: "A fresh set of ten multiple choice questions every day for Pakistani exam preparation. Same questions for every visitor today.",
  alternates: { canonical: absolute('/today') },
}

export default function TodayPage() {
  return (
    <PracticeFlow
      mode="today"
      title="Today's Test"
      titleUr="آج کا ٹیسٹ"
      itemKey={todaySeed()}
      available={10}
      autoStart
    />
  )
}
