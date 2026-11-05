'use client'

import { useState } from 'react'
import { IconFlag } from '@/components/icons'
import { useLang } from '@/components/i18n'
import { copyFor } from '@/lib/copy'

const REASONS = [
  { value: 'wrong-answer', en: 'The marked answer is wrong', ur: 'درج جواب غلط ہے' },
  { value: 'typo', en: 'Spelling or typing mistake', ur: 'املا کی غلطی' },
  { value: 'unclear', en: 'Question is unclear', ur: 'سوال واضح نہیں' },
  { value: 'duplicate', en: 'Repeated question', ur: 'دہرایا ہوا سوال' },
  { value: 'other', en: 'Something else', ur: 'کچھ اور' },
]

export default function ReportButton({ mcqId }: { mcqId: string }) {
  const lang = useLang()
  const t = copyFor(lang)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('wrong-answer')
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle')

  if (state === 'done') {
    return (
      <p className="report-done" role="status">
        <IconFlag size={14} /> {t.reportSent}
      </p>
    )
  }

  return (
    <div className="report">
      {!open ? (
        <button type="button" className="report-trigger" onClick={() => setOpen(true)}>
          <IconFlag size={14} /> {t.report}
        </button>
      ) : (
        <div className="report-panel">
          <label className="report-label" htmlFor={`reason-${mcqId}`}>
            {t.reportWhy}
          </label>
          <select
            id={`reason-${mcqId}`}
            className="report-select"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          >
            {REASONS.map((option) => (
              <option key={option.value} value={option.value}>
                {lang === 'ur' ? option.ur : option.en}
              </option>
            ))}
          </select>
          <textarea
            className="report-note"
            rows={2}
            value={note}
            maxLength={500}
            placeholder={lang === 'ur' ? 'اختیاری وضاحت' : 'Optional details'}
            onChange={(event) => setNote(event.target.value)}
          />
          <div className="report-actions">
            <button
              type="button"
              className="btn btn-dark btn-sm"
              disabled={state === 'busy'}
              onClick={async () => {
                setState('busy')
                try {
                  const response = await fetch('/api/report', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ mcqId, reason, note }),
                  })
                  setState(response.ok ? 'done' : 'failed')
                } catch {
                  setState('failed')
                }
              }}
            >
              {t.submit}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
              {t.cancel}
            </button>
          </div>
          {state === 'failed' && (
            <p className="form-error">
              {lang === 'ur' ? 'شکایت نہیں بھیجی جا سکی۔ دوبارہ کوشش کریں۔' : 'Could not send the report. Please try again.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
