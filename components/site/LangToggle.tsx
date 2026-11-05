'use client'

import { toggleLang } from '@/components/i18n'

export default function LangToggle() {
  return (
    <button type="button" className="lang-toggle" onClick={toggleLang} aria-label="English / اردو">
      <span className="t-en" lang="en">
        اردو
      </span>
      <span className="t-ur" lang="ur">
        English
      </span>
    </button>
  )
}
