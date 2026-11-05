'use client'

import { useState } from 'react'
import { T } from '@/components/text'

type State = 'idle' | 'sending' | 'sent' | 'error'

export default function ContactForm() {
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState('')

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const payload = {
      name: String(data.get('name') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      message: String(data.get('message') ?? '').trim(),
    }
    if (!payload.name || !payload.email || !payload.message) {
      setError('Please fill in every field.')
      setState('error')
      return
    }
    setState('sending')
    setError('')
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error('failed')
      form.reset()
      setState('sent')
    } catch {
      setError('Could not send the message. Please email us instead.')
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <p className="form-success" role="status">
        <T en="Thank you — your message has been sent. We usually reply within a few days." ur="شکریہ — آپ کا پیغام بھیج دیا گیا ہے۔ ہم چند دنوں میں جواب دیتے ہیں۔" />
      </p>
    )
  }

  return (
    <form className="contact-form" onSubmit={onSubmit}>
      <label className="field">
        <span>
          <T en="Your name" ur="آپ کا نام" />
        </span>
        <input name="name" type="text" maxLength={80} required autoComplete="name" />
      </label>
      <label className="field">
        <span>
          <T en="Your email" ur="آپ کا ای میل" />
        </span>
        <input name="email" type="email" maxLength={120} required autoComplete="email" />
      </label>
      <label className="field">
        <span>
          <T en="Message" ur="پیغام" />
        </span>
        <textarea name="message" rows={5} maxLength={2000} required />
      </label>
      {state === 'error' && <p className="form-error">{error}</p>}
      <button type="submit" className="btn btn-dark btn-lg" disabled={state === 'sending'}>
        <T en={state === 'sending' ? 'Sending…' : 'Send message'} ur={state === 'sending' ? 'بھیجا جا رہا ہے…' : 'پیغام بھیجیں'} />
      </button>
    </form>
  )
}
