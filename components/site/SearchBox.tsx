'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '@/components/i18n'
import { copyFor } from '@/lib/copy'
import { IconSearch } from '@/components/icons'

export type SearchEntry = {
  kind: 'exam' | 'subject' | 'book'
  key: string
  name: string
  nameUr: string | null
  count: number
  href: string
}

const LABEL: Record<SearchEntry['kind'], { en: string; ur: string }> = {
  exam: { en: 'Exam', ur: 'امتحان' },
  subject: { en: 'Subject', ur: 'مضمون' },
  book: { en: 'Book', ur: 'کتاب' },
}

/** Type-ahead over exams, subjects and books. The list is small, so it is local. */
export default function SearchBox({ index }: { index: SearchEntry[] }) {
  const lang = useLang()
  const t = copyFor(lang)
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement | null>(null)

  const term = query.trim().toLowerCase()
  const results = useMemo(() => {
    if (term.length < 2) return []
    return index
      .filter(
        (entry) =>
          entry.name.toLowerCase().includes(term) ||
          (entry.nameUr ?? '').includes(query.trim()) ||
          entry.key.includes(term),
      )
      .slice(0, 6)
  }, [index, term, query])

  useEffect(() => {
    setActive(0)
  }, [term])

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const go = (entry: SearchEntry) => {
    setOpen(false)
    setQuery('')
    router.push(entry.href)
  }

  const submit = () => {
    if (term.length < 2) return
    if (results.length > 0) {
      go(results[Math.min(active, results.length - 1)])
      return
    }
    setOpen(false)
    router.push(`/search?q=${encodeURIComponent(query.trim())}`)
  }

  return (
    <div className="search" ref={boxRef}>
      <div className="search-field">
        <span className="search-icon" aria-hidden="true">
          <IconSearch size={16} />
        </span>
        <input
          type="search"
          className="search-input"
          placeholder={t.searchPlaceholder}
          aria-label={t.searchPlaceholder}
          value={query}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-autocomplete="list"
          style={{ direction: lang === 'ur' ? 'rtl' : 'ltr' }}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setActive((value) => Math.min(value + 1, results.length - 1))
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActive((value) => Math.max(0, value - 1))
            } else if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            } else if (event.key === 'Escape') {
              setOpen(false)
            }
          }}
        />
      </div>

      {open && term.length >= 2 && (
        <ul className="search-results" role="listbox" aria-label={t.searchPlaceholder}>
          {results.length === 0 ? (
            <li className="search-empty">{t.noResults}</li>
          ) : (
            results.map((entry, i) => (
              <li key={`${entry.kind}-${entry.key}`} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  className="search-result"
                  data-active={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(entry)}
                >
                  <span className="search-result-name">{lang === 'ur' && entry.nameUr ? entry.nameUr : entry.name}</span>
                  <span className="search-result-meta">
                    {lang === 'ur' ? LABEL[entry.kind].ur : LABEL[entry.kind].en} · {entry.count}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
