import type { Metadata, Viewport } from 'next'
import '@fontsource-variable/inter'
import '@fontsource/noto-nastaliq-urdu/400.css'
import './globals.css'
import Header from '@/components/site/Header'
import Footer from '@/components/site/Footer'
import { Reveal } from '@/components/Reveal'
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — ${SITE_TAGLINE}`, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: 'en_PK',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: `${SITE_NAME} — ${SITE_TAGLINE}` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ['/og.png'],
  },
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }], apple: [{ url: '/icon.svg' }] },
  robots: { index: true, follow: true },
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}

// Applied before first paint so a returning Urdu reader never sees a flash of English.
const LANG_SCRIPT = `try{if(localStorage.getItem('dailytest.lang')==='ur'){document.documentElement.lang='ur';document.documentElement.dir='rtl'}}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <script dangerouslySetInnerHTML={{ __html: LANG_SCRIPT }} />
      </head>
      <body>
        <Reveal />
        <Header />
        <main className="main">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
