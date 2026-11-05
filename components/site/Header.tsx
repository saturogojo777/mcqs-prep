'use client'

import Link from 'next/link'
import { toggleLang } from '@/components/i18n'
import { T } from '@/components/text'

export default function Header() {
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Link href="/" className="brand" aria-label="DailyTest home">
          DailyTest
        </Link>
        <nav className="topbar-nav" aria-label="Main">
          <Link href="/about" className="topbar-link">
            <T en="About" ur="تعارف" />
          </Link>
          <Link href="/contact" className="topbar-link">
            <T en="Contact" ur="رابطہ" />
          </Link>
          <button type="button" className="lang-toggle" onClick={toggleLang} aria-label="English / اردو">
            <span className="t-en" lang="en">
              اردو
            </span>
            <span className="t-ur" lang="ur">
              English
            </span>
          </button>
        </nav>
      </div>
    </header>
  )
}
