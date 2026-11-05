import type { Metadata } from 'next'
import Home from '@/components/Home'
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from '@/lib/site'

export const metadata: Metadata = {
  title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description: SITE_DESCRIPTION,
}

export default function HomePage() {
  return <Home />
}
