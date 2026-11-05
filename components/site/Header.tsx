import Link from 'next/link'
import LangToggle from '@/components/site/LangToggle'
import SearchBox from '@/components/site/SearchBox'
import { T } from '@/components/text'
import { getSearchIndex } from '@/lib/search-index'

export default async function Header() {
  const index = await getSearchIndex()
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Link href="/" className="brand" aria-label="DailyTest home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 4h7a8 8 0 0 1 0 16H5z" />
              <path d="M9 9h2.5M9 13h2.5" />
            </svg>
          </span>
          <span className="brand-name">DailyTest</span>
        </Link>

        <SearchBox index={index} />

        <nav className="topbar-nav" aria-label="Main">
          <Link href="/exams" className="topbar-link">
            <T en="Exams" ur="امتحانات" />
          </Link>
          <Link href="/subjects" className="topbar-link">
            <T en="Subjects" ur="مضامین" />
          </Link>
          <Link href="/books" className="topbar-link">
            <T en="Books" ur="کتابیں" />
          </Link>
          <Link href="/progress" className="topbar-link">
            <T en="Progress" ur="پیش رفت" />
          </Link>
          <LangToggle />
        </nav>
      </div>
    </header>
  )
}
