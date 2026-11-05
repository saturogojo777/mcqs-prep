'use client'

import { useEffect, useState } from 'react'
import type { Lang } from '@/lib/types'

const LANG_KEY = 'dailytest.lang'
const LANG_EVENT = 'dailytest:lang'

export function currentLang(): Lang {
  if (typeof document === 'undefined') return 'en'
  return document.documentElement.dir === 'rtl' ? 'ur' : 'en'
}

export function applyLang(lang: Lang) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr'
  try {
    window.localStorage.setItem(LANG_KEY, lang)
  } catch {
    // private mode: the toggle still works for this page view
  }
  window.dispatchEvent(new Event(LANG_EVENT))
}

export function toggleLang() {
  applyLang(currentLang() === 'ur' ? 'en' : 'ur')
}

/** Follows the language the <html> element is already using (set before paint). */
export function useLang(): Lang {
  const [lang, setLang] = useState<Lang>('en')
  useEffect(() => {
    const sync = () => setLang(currentLang())
    sync()
    window.addEventListener(LANG_EVENT, sync)
    return () => window.removeEventListener(LANG_EVENT, sync)
  }, [])
  return lang
}
