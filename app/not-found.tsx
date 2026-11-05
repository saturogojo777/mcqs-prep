import Link from 'next/link'
import { T } from '@/components/text'
import { SITE_NAME } from '@/lib/site'

export default function NotFound() {
  return (
    <div className="container page notfound">
      <p className="eyebrow">404</p>
      <h1 className="page-title">
        <T en="This page moved or never existed" ur="یہ صفحہ موجود نہیں یا ہٹ گیا ہے" />
      </h1>
      <p className="page-sub">
        <T
          en="The link may be old. Start from one of these instead."
          ur="لنک پرانا ہو سکتا ہے۔ ان میں سے کسی ایک سے شروع کریں۔"
        />
      </p>
      <div className="notfound-actions">
        <Link href="/" className="btn btn-dark">
          <T en="Home" ur="ہوم" />
        </Link>
        <Link href="/exams" className="btn btn-outline">
          <T en="Exams" ur="امتحانات" />
        </Link>
        <Link href="/subjects" className="btn btn-outline">
          <T en="Subjects" ur="مضامین" />
        </Link>
        <Link href="/today" className="btn btn-ghost">
          <T en="Today's Test" ur="آج کا ٹیسٹ" />
        </Link>
      </div>
      <p className="page-foot-note">
        <T en={`${SITE_NAME} · free MCQ practice for Pakistani exams`} ur="ڈیلی ٹیسٹ · پاکستانی امتحانات کے لیے مفت مشق" />
      </p>
    </div>
  )
}
