import type { Metadata } from 'next'
import Breadcrumbs from '@/components/Breadcrumbs'
import ProgressView from '@/components/ProgressView'
import { absolute } from '@/lib/site'

export const metadata: Metadata = {
  title: 'My progress — accuracy, tests taken and daily streak',
  description:
    'Your own accuracy by subject, the number of tests you have taken and your daily streak. Stored in your browser only, no account needed.',
  alternates: { canonical: absolute('/progress') },
  robots: { index: false, follow: true },
}

export default function ProgressPage() {
  return (
    <>
      <Breadcrumbs trail={[{ href: '/progress', name: 'Progress' }]} />
      <ProgressView />
    </>
  )
}
