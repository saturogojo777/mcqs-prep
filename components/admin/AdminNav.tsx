'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/admin', label: 'Import' },
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/patterns', label: 'Test patterns' },
]

export default function AdminNav() {
  const pathname = usePathname()
  return (
    <nav className="admin-nav" aria-label="Admin sections">
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} data-on={pathname === link.href}>
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
