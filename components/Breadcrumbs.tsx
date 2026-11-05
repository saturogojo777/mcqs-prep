import Link from 'next/link'
import { SITE_URL } from '@/lib/site'

type Crumb = { href: string; name: string }

/** Visible breadcrumb trail plus the matching JSON-LD block for search engines. */
export default function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  const full = [{ href: '/', name: 'Home' }, ...trail]
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: full.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: `${SITE_URL}${crumb.href}`,
    })),
  }
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <nav className="crumbs container" aria-label="Breadcrumb">
        {full.map((crumb, index) => (
          <span key={crumb.href} className="crumb">
            {index < full.length - 1 ? (
              <Link href={crumb.href}>{crumb.name}</Link>
            ) : (
              <span aria-current="page">{crumb.name}</span>
            )}
            {index < full.length - 1 && <span className="crumb-sep" aria-hidden="true">/</span>}
          </span>
        ))}
      </nav>
    </>
  )
}
