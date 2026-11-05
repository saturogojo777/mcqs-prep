import Link from 'next/link'
import { T } from '@/components/text'
import { CONTACT_EMAIL, OWNER, SITE_NAME } from '@/lib/site'
import { getSearchIndex } from '@/lib/search-index'

const LEGAL = [
  { href: '/about', en: 'About', ur: 'تعارف' },
  { href: '/contact', en: 'Contact', ur: 'رابطہ' },
  { href: '/privacy', en: 'Privacy Policy', ur: 'پرائیویسی پالیسی' },
  { href: '/terms', en: 'Terms', ur: 'شرائط' },
  { href: '/disclaimer', en: 'Disclaimer', ur: 'دستبرداری' },
]

export default async function Footer() {
  const index = await getSearchIndex()
  const subjects = index.filter((entry) => entry.kind === 'subject' && entry.count > 0).slice(0, 6)
  const exams = index.filter((entry) => entry.kind === 'exam').slice(0, 6)

  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div className="footer-col footer-col--brand">
          <p className="footer-brand">{SITE_NAME}</p>
          <p className="footer-blurb">
            <T
              en="Free practice questions for Pakistan's government exams. No account, no cost, English and Urdu."
              ur="پاکستان کے سرکاری امتحانات کے لیے مفت مشقی سوالات۔ نہ اکاؤنٹ، نہ فیس، انگریزی اور اردو۔"
            />
          </p>
        </div>

        <div className="footer-col">
          <p className="footer-heading">
            <T en="Exams" ur="امتحانات" />
          </p>
          <ul>
            {exams.map((entry) => (
              <li key={entry.key}>
                <Link href={entry.href}>{entry.name}</Link>
              </li>
            ))}
            <li>
              <Link href="/exams">
                <T en="All exams" ur="تمام امتحانات" />
              </Link>
            </li>
          </ul>
        </div>

        <div className="footer-col">
          <p className="footer-heading">
            <T en="Subjects" ur="مضامین" />
          </p>
          <ul>
            {subjects.map((entry) => (
              <li key={entry.key}>
                <Link href={entry.href}>{entry.name}</Link>
              </li>
            ))}
            <li>
              <Link href="/subjects">
                <T en="All subjects" ur="تمام مضامین" />
              </Link>
            </li>
          </ul>
        </div>

        <div className="footer-col">
          <p className="footer-heading">
            <T en="Site" ur="سائٹ" />
          </p>
          <ul>
            {LEGAL.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>
                  <T en={link.en} ur={link.ur} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="container footer-bottom">
        <p className="footer-note">
          <T
            en={`${SITE_NAME} · run by ${OWNER} · ${CONTACT_EMAIL}`}
            ur={`ڈیلی ٹیسٹ · ${OWNER} · ${CONTACT_EMAIL}`}
          />
        </p>
        <p className="footer-note footer-note--small">
          <T
            en="Practice material only. Not affiliated with any government board."
            ur="صرف مشقی مواد۔ کسی سرکاری بورڈ سے وابستہ نہیں۔"
          />
        </p>
      </div>
    </footer>
  )
}
