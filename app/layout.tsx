import type { Metadata, Viewport } from 'next'
import '@fontsource/noto-nastaliq-urdu/400.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'MCQ Practice',
  description:
    'Fast, distraction free MCQ practice for Pakistani exam preparation. Practice and test mode, English and Urdu.',
  applicationName: 'MCQ Practice',
  appleWebApp: { capable: true, title: 'MCQ Practice', statusBarStyle: 'default' },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f4f1' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1114' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
