'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function CheckIn() {
  const supabase = createClient()
  const [bookingId, setBookingId] = useState('')
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const { error } = await supabase.rpc('check_in', { p_booking_id: bookingId })
    setSubmitting(false)
    setResult(error ? { ok: false, text: error.message } : { ok: true, text: 'Checked in ✓' })
    setBookingId('')
  }

  return (
    <form onSubmit={submit} className="max-w-sm mx-auto mt-16 space-y-3 p-4">
      <h1 className="text-xl font-semibold">Check-in</h1>
      <input className="w-full border rounded p-2" placeholder="Scan or paste booking ID"
        value={bookingId} onChange={e => setBookingId(e.target.value)} autoFocus />
      <button disabled={submitting} className="w-full bg-black text-white rounded p-2 disabled:opacity-50">
        {submitting ? 'Checking in…' : 'Check in'}
      </button>
      {result && <p className={result.ok ? 'text-green-600' : 'text-red-600'}>{result.text}</p>}
    </form>
  )
}