'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AdminNav from '@/components/admin/AdminNav'

/** Shared chrome for the admin pages: auth probe, top bar and section nav. */
export default function AdminFrame({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  const [email, setEmail] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    let alive = true
    fetch('/api/admin/me')
      .then((response) => response.json() as Promise<{ email: string | null }>)
      .then((data) => {
        if (alive) setEmail(data.email ?? null)
      })
      .catch(() => {
        if (alive) setEmail(null)
      })
    return () => {
      alive = false
    }
  }, [])

  return (
    <>
      <header className="topbar">
        <div className="container topbar-inner">
          <Link className="brand" href="/">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 4h7a8 8 0 0 1 0 16H5z" />
                <path d="M9 9h2.5M9 13h2.5" />
              </svg>
            </span>
            <span className="brand-name">DailyTest</span>
          </Link>
          <span className="topbar-note">Admin</span>
        </div>
      </header>
      <main className="main">
        <div className="container">
          <div className="admin-head">
            <div>
              <h1 className="admin-title">{title}</h1>
              {subtitle && <p className="page-sub">{subtitle}</p>}
            </div>
            {email ? (
              <Link href="/admin" className="btn btn-ghost btn-sm">
                Import
              </Link>
            ) : null}
          </div>
          <AdminNav />
          {email === undefined ? (
            <p className="note">Checking access…</p>
          ) : email === null ? (
            <section className="card">
              <h2 className="card-title">Sign in required</h2>
              <p className="note">Open the import page and sign in first.</p>
              <Link href="/admin" className="btn btn-dark">
                Go to sign in
              </Link>
            </section>
          ) : (
            children
          )}
        </div>
      </main>
    </>
  )
}
