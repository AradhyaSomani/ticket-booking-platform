'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AuthGuard from '@/components/AuthGuard'

export default function CheckIn() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()
  const [bookingId, setBookingId] = useState('')
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setResult(null)
    const { error } = await supabase.rpc('check_in', { p_booking_id: bookingId.trim() })
    setSubmitting(false)
    setResult(error ? { ok: false, text: error.message } : { ok: true, text: 'Checked in successfully.' })
    setBookingId('')
  }

  return (
    <AuthGuard>
      <div className="max-w-sm mx-auto px-4 py-24">
        <form onSubmit={submit} className="ticket p-6 space-y-4">
          <h1 className="font-display text-2xl font-bold">Check-in</h1>
          <p className="text-sm text-muted">Paste or scan a booking ID to check the attendee in.</p>

          <input
            className="w-full bg-surface border border-hairline rounded-lg px-3 py-2 text-sm placeholder:text-muted focus:border-gold outline-none transition-colors font-seat"
            placeholder="Booking ID"
            value={bookingId}
            onChange={e => setBookingId(e.target.value)}
            autoFocus
          />

          <button disabled={submitting || !bookingId.trim()}
            className="w-full bg-gold text-white rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-gold-dim transition-colors disabled:opacity-50">
            {submitting ? 'Checking in…' : 'Check in'}
          </button>

          {result && (
            <p className={`text-sm ${result.ok ? 'text-available' : 'text-danger'}`}>{result.text}</p>
          )}
        </form>
      </div>
    </AuthGuard>
  )
}