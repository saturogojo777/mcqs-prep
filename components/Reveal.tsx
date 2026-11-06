'use client'

import { useEffect } from 'react'

/**
 * Scroll-reveal: elements with `data-reveal` fade up once they enter the
 * viewport. A timed fallback reveals everything shortly after load so content
 * is never stuck hidden (slow observers, screenshots, JS quirks). Fully
 * disabled under prefers-reduced-motion via CSS.
 */
export function Reveal() {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('js-reveal')
    const seen = new WeakSet<Element>()
    let io: IntersectionObserver | null = null
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add('revealed')
              io?.unobserve(entry.target)
            }
          }
        },
        { rootMargin: '48px 0px' },
      )
    }
    const scan = () => {
      document.querySelectorAll('[data-reveal]:not(.revealed)').forEach((el) => {
        if (seen.has(el)) return
        seen.add(el)
        if (io) io.observe(el)
        else el.classList.add('revealed')
      })
    }
    scan()
    const mo = new MutationObserver(scan)
    if (document.body) mo.observe(document.body, { childList: true, subtree: true })
    const fallback = window.setTimeout(() => {
      document.querySelectorAll('[data-reveal]:not(.revealed)').forEach((el) => el.classList.add('revealed'))
    }, 900)
    return () => {
      io?.disconnect()
      mo.disconnect()
      window.clearTimeout(fallback)
    }
  }, [])
  return null
}
