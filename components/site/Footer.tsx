import Link from 'next/link'
import { T } from '@/components/text'
import { CONTACT_EMAIL } from '@/lib/site'

const LINKS = [
  { href: '/about', en: 'About', ur: 'تعارف' },
  { href: '/contact', en: 'Contact', ur: 'رابطہ' },
  { href: '/privacy', en: 'Privacy Policy', ur: 'پرائیویسی پالیسی' },
  { href: '/terms', en: 'Terms', ur: 'شرائط' },
  { href: '/disclaimer', en: 'Disclaimer', ur: 'دستبرداری' },
]

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <nav className="footer-links" aria-label="Site">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              <T en={link.en} ur={link.ur} />
            </Link>
          ))}
        </nav>
        <p className="footer-note">
          <T
            en={`DailyTest · made by Saturo Gojo, Okara, Punjab, Pakistan · ${CONTACT_EMAIL}`}
            ur={`ڈیلی ٹیسٹ · سترو گوجو، اوکاڑہ، پنجاب، پاکستان · ${CONTACT_EMAIL}`}
          />
        </p>
      </div>
    </footer>
  )
}
