import type { ReactNode } from 'react'

/**
 * Both languages are always in the HTML; CSS shows the one matching <html dir>.
 * No flash, no hydration mismatch, and search engines see both.
 */
export function T({ en, ur }: { en: ReactNode; ur: ReactNode }) {
  return (
    <>
      <span className="t-en" lang="en">
        {en}
      </span>{' '}
      <span className="t-ur" lang="ur">
        {ur}
      </span>
    </>
  )
}

/** Numbers stay left-to-right (and in the Latin face) inside Urdu sentences. */
export function Num({ children }: { children: ReactNode }) {
  return <span className="num">{children}</span>
}

/** "1 question" / "2 questions" (and the Urdu singular/plural) in one place. */
export function Count({
  n,
  one,
  many,
  oneUr,
  manyUr,
}: {
  n: number
  one: string
  many: string
  oneUr: string
  manyUr: string
}) {
  const formatted = new Intl.NumberFormat('en-US').format(n)
  return (
    <>
      <Num>{formatted}</Num>{' '}
      <T en={n === 1 ? one : many} ur={n === 1 ? oneUr : manyUr} />
    </>
  )
}
