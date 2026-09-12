'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { QRCodeSVG } from 'qrcode.react'
import AuthGuard from '@/components/AuthGuard'

type BookingRow = {
  id: string
  status: string
  created_at: string
  checked_in_at: string | null
  seats: { label: string }
  events: { id: string; title: string; venue: string; starts_at: string }
}

export default function MyBookings() {
  const supabase = createClient()
  const [rows, setRows] = useState<BookingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('bookings')
      .select('id, status, created_at, checked_in_at, seats!inner(label), events!inner(id, title, venue, starts_at)')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    setRows((data ?? []) as unknown as BookingRow[])
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (cancelled) return
      await load()
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function cancel(bookingId: string) {
    setBusyId(bookingId)
    setError(null)
    const { error } = await supabase.rpc('cancel_booking', { p_booking_id: bookingId })
    setBusyId(null)
    if (error) return setError(error.message)
    load()
  }

  if (loading) {
    return (
      <AuthGuard>
        <div className="max-w-2xl mx-auto px-4 py-10 space-y-4">
          {[0, 1].map(i => <div key={i} className="ticket h-24 animate-pulse bg-surface-raised/40" />)}
        </div>
      </AuthGuard>
    )
  }

  if (error) {
    return (
      <AuthGuard>
        <div className="max-w-2xl mx-auto px-4 py-10 text-danger">Could not load your bookings — {error}</div>
      </AuthGuard>
    )
  }

  if (!rows.length) {
    return (
      <AuthGuard>
        <div className="max-w-2xl mx-auto px-4 py-10">
          <div className="border border-dashed border-hairline rounded-md p-10 text-center text-muted">
            No tickets yet — find something on the Events page.
          </div>
        </div>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard>
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-4">
        <h1 className="font-display text-2xl mb-6">My tickets</h1>
        {rows.map(b => {
          const isPast = new Date(b.events.starts_at) <= new Date()
          const isCancelled = b.status === 'cancelled'
          return (
            <div key={b.id} className={`ticket flex gap-4 p-5 ${isCancelled ? 'opacity-50' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="font-display text-lg truncate">{b.events.title}</p>
                <p className="font-seat text-gold text-sm mt-0.5">Seat {b.seats.label}</p>
                <p className="text-sm text-muted mt-1">{b.events.venue}</p>
                <p className="text-sm text-muted">{new Date(b.events.starts_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                <p className="text-xs mt-2">
                  <span className={isCancelled ? 'text-muted' : 'text-available'}>{b.status}</span>
                  {b.checked_in_at && <span className="text-gold"> · checked in</span>}
                </p>
                {b.status === 'booked' && !isPast && (
                  <button disabled={busyId === b.id} onClick={() => cancel(b.id)}
                    className="mt-3 text-xs text-danger border border-danger/50 rounded px-3 py-1.5 hover:bg-danger/10 transition-colors">
                    {busyId === b.id ? 'Cancelling…' : 'Cancel ticket'}
                  </button>
                )}
              </div>
              {b.status === 'booked' && !isPast && (
                <div className="ticket-divider pl-4 flex items-center flex-shrink-0">
                  <QRCodeSVG value={b.id} size={72} bgColor="transparent" fgColor="#F2EEE6" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </AuthGuard>
  )
}