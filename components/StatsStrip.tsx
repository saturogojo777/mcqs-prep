'use client'

import { useEffect, useRef, useState } from 'react'
import { T } from '@/components/text'
import type { SiteStats } from '@/lib/types'

type Stat = { value: number; one: string; many: string; oneUr: string; manyUr: string }

function useCountUp(target: number, duration = 900): number {
  // SSR (and no-JS) HTML carries the true value; the count-up restarts from
  // zero only after mount, so crawlers and readers never see a mid-flight lie.
  const [value, setValue] = useState(target)
  const frame = useRef(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }
    setValue(0)
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [target, duration])
  return value
}

function StatCell({ stat }: { stat: Stat }) {
  const value = useCountUp(stat.value)
  const label = value === 1 ? stat.one : stat.many
  const labelUr = value === 1 ? stat.oneUr : stat.manyUr
  return (
    <div className="stat">
      <span className="stat-value num">{new Intl.NumberFormat('en-US').format(value)}</span>
      <span className="stat-label">
        <T en={label} ur={labelUr} />
      </span>
    </div>
  )
}

/** Live library totals with a gentle count-up (off when reduced motion is set). */
export default function StatsStrip({ stats }: { stats: SiteStats }) {
  const items: Stat[] = [
    { value: stats.questions, one: 'question', many: 'questions', oneUr: 'سوال', manyUr: 'سوالات' },
    { value: stats.subjects, one: 'subject', many: 'subjects', oneUr: 'مضمون', manyUr: 'مضامین' },
    { value: stats.exams, one: 'exam', many: 'exams', oneUr: 'امتحان', manyUr: 'امتحانات' },
    { value: stats.books, one: 'book', many: 'books', oneUr: 'کتاب', manyUr: 'کتابیں' },
  ]
  return (
    <section className="stats-strip" aria-label="Library size">
      {items.map((stat) => (
        <StatCell key={stat.many} stat={stat} />
      ))}
    </section>
  )
}
