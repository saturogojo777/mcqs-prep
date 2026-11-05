/**
 * One place for the site address. Everything user-facing (canonical links,
 * sitemap, robots, social tags) reads from NEXT_PUBLIC_SITE_URL, so switching to
 * a custom domain is a matter of changing that one environment variable.
 */
const FALLBACK = 'https://mcqs-prep-eta.vercel.app'

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || FALLBACK).replace(/\/+$/, '')

export const SITE_NAME = 'DailyTest'
export const SITE_TAGLINE = "Daily practice for Pakistan's exams"
export const SITE_DESCRIPTION =
  'Free MCQ practice for Pakistani exams. Pick an exam, subject or book, choose how many questions, and start. English and Urdu, no sign-up.'

export const CONTACT_EMAIL = 'ta71264006@gmail.com'
export const OWNER = 'Saturo Gojo, Okara, Punjab, Pakistan'

export const absolute = (path: string) => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
