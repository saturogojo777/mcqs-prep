import type { Metadata, Viewport } from 'next'
import '@fontsource-variable/inter'
import '@fontsource/noto-nastaliq-urdu/400.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'MCQ Practice — focused exam prep',
  description:
    'Short, focused MCQ practice for Pakistani exam prep. Practice and test mode, English and Urdu, progress saved on your device.',
  applicationName: 'MCQ Practice',
  appleWebApp: { capable: true, title: 'MCQ Practice', statusBarStyle: 'default' },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
