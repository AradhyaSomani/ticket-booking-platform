'use client'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Seat = {
  id: string; label: string; row_index: number; col_index: number
  category: string; price_override: number | null
}

type Event = {
  price: number
  starts_at: string
  cover_url: string | null
  title: string
  venue: string
  description: string | null
}

type BookingRow = { seat_id: string }
type HoldRow = { seat_id: string; user_id: string }

export default function EventPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = useMemo(() => createClient(), [])

  const [event, setEvent] = useState<Event | null>(null)
  const [seats, setSeats] = useState<Seat[]>([])
  const [bookedSeatIds, setBookedSeatIds] = useState<Set<string>>(new Set())
  const [heldSeatIds, setHeldSeatIds] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [holding, setHolding] = useState(false)
  const [holdExpiresAt, setHoldExpiresAt] = useState<Date | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)

  async function loadAll() {
    const [{ data: ev, error: evError }, { data: seatRows }, { data: bookingRows }] =
      await Promise.all([
        supabase.from('events').select('*').eq('id', id).single(),
        supabase.from('seats').select('*').eq('event_id', id).order('row_index').order('col_index'),
        supabase.from('bookings').select('seat_id').eq('event_id', id).eq('status', 'booked'),
      ])
    if (evError) {
      setMessage({ type: 'error', text: `Couldn't load event: ${evError.message}` })
      setLoading(false)
      return
    }
    setEvent(ev)
    setSeats(seatRows ?? [])
    setBookedSeatIds(new Set((bookingRows ?? []).map((b: BookingRow) => b.seat_id)))
    setLoading(false)
  }

  async function loadHolds() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('holds')
      .select('seat_id, user_id')
      .gt('expires_at', new Date().toISOString())
    setHeldSeatIds(new Set((data ?? []).filter((h: HoldRow) => h.user_id !== user?.id).map((h: HoldRow) => h.seat_id)))
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await loadAll()
      if (cancelled) return
      await loadHolds()
    })()

    const channel = supabase
      .channel(`event-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `event_id=eq.${id}` },
        () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'holds' }, () => loadHolds())
      .subscribe()

    return () => { cancelled = true; supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!holdExpiresAt) return
    const tick = () => {
      const remaining = Math.max(0, Math.round((holdExpiresAt.getTime() - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining === 0) {
        setMessage({ type: 'error', text: 'Your hold expired — please reselect your seats' })
        setSelected(new Set())
        setHoldExpiresAt(null)
        loadAll()
        loadHolds()
      }
    }
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdExpiresAt])

  useEffect(() => {
    return () => {
      if (selected.size) supabase.rpc('release_hold', { p_seat_ids: Array.from(selected) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleSeat(seatId: string) {
    if (bookedSeatIds.has(seatId) || heldSeatIds.has(seatId)) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(seatId)) next.delete(seatId)
      else {
        if (next.size >= 4) {
          setMessage({ type: 'error', text: 'You can select up to 4 seats only' })
          return prev
        }
        next.add(seatId)
      }
      return next
    })
  }

  async function holdSelected() {
    setHolding(true)
    setMessage(null)
    const { data, error } = await supabase.rpc('hold_seats', { p_event_id: id, p_seat_ids: Array.from(selected) })
    setHolding(false)
    if (error) {
      setMessage({ type: 'error', text: error.message })
      setSelected(new Set())
      await loadAll(); await loadHolds()
      return
    }
    setHoldExpiresAt(new Date(data))
  }

  async function confirmBooking() {
    setConfirming(true)
    setMessage(null)
    const { data, error } = await supabase.rpc('book_seats', { p_event_id: id, p_seat_ids: Array.from(selected) })
    setConfirming(false)
    if (error) {
      setMessage({ type: 'error', text: error.message })
      setSelected(new Set())
      setHoldExpiresAt(null)
      await loadAll(); await loadHolds()
      return
    }
    setMessage({ type: 'success', text: `${data.length} seat${data.length > 1 ? 's' : ''} confirmed. Find your ticket under My bookings.` })
    setSelected(new Set())
    setHoldExpiresAt(null)
    await loadAll(); await loadHolds()
  }

  function seatPrice(seat: Seat, eventPrice: number) {
    return seat.price_override ?? eventPrice
  }

  if (loading) return <div className="max-w-5xl mx-auto px-4 py-10 text-muted">Loading seat map…</div>
  if (!event) return <div className="max-w-5xl mx-auto px-4 py-10 text-danger">Event not found.</div>

  const isPast = new Date(event.starts_at) <= new Date()
  const selectedSeats = Array.from(selected).map(sid => seats.find(s => s.id === sid)!)
  const total = selectedSeats.reduce((sum, s) => sum + seatPrice(s, event.price), 0)

  // Group seats by row letter for the two-sided row-label grid
  const rowLetters = Array.from(new Set(seats.map(s => s.label[0]))).sort()

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="grid md:grid-cols-[300px_1fr] gap-8">
        {/* Left column: poster + details + selected tickets */}
        <div>
          <div className="ticket overflow-hidden mb-4">
            <div className="aspect-[2/3] bg-surface-raised">
              {event.cover_url ? (
                <img src={event.cover_url} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-display text-5xl text-gold/40">
                  {event.title[0]}
                </div>
              )}
            </div>
          </div>

          <h1 className="font-display text-2xl font-bold">{event.title}</h1>
          <p className="text-sm text-muted mt-1">{event.venue}</p>
          <p className="text-sm text-muted">{new Date(event.starts_at).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })}</p>
          {event.description && <p className="text-sm mt-3">{event.description}</p>}

          {selectedSeats.length > 0 && (
            <div className="mt-6">
              <p className="text-xs text-muted mb-2 uppercase tracking-wide">Selected tickets</p>
              <div className="space-y-2">
                {selectedSeats.map(s => (
                  <div key={s.id} className="ticket flex items-center justify-between px-3 py-2 text-sm">
                    <span>Seat <span className="font-seat text-gold">{s.label}</span></span>
                    <span className="text-muted">₹{seatPrice(s, event.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column: seat map */}
        <div>
          {isPast ? (
            <p className="text-danger">This event has already happened — booking is closed.</p>
          ) : (
            <>
              <div className="ticket p-6">
                <div className="screen-arc mb-1" />
                <p className="text-center text-xs text-muted tracking-widest uppercase mb-6">Screen</p>

                <div className="overflow-x-auto">
                  <div className="flex flex-col gap-1.5 items-center min-w-max mx-auto">
                    {rowLetters.map(letter => {
                      const rowSeats = seats.filter(s => s.label[0] === letter)
                      return (
                        <div key={letter} className="flex items-center gap-1.5">
                          <span className="w-5 text-xs text-muted text-center flex-shrink-0">{letter}</span>
                          {rowSeats.map(seat => {
                            const isBooked = bookedSeatIds.has(seat.id)
                            const isHeld = heldSeatIds.has(seat.id)
                            const isSelected = selected.has(seat.id)
                            const isPremium = seat.category === 'premium'
                            return (
                              <button
                                key={seat.id}
                                disabled={isBooked || isHeld}
                                onClick={() => toggleSeat(seat.id)}
                                title={`${seat.label} · ₹${seatPrice(seat, event.price)}${isPremium ? ' · premium' : ''}`}
                                className={`h-7 w-7 font-seat text-[9px] rounded flex items-center justify-center border transition-colors flex-shrink-0
                                  ${isBooked ? 'bg-surface-raised text-muted/50 border-transparent cursor-not-allowed' :
                                    isHeld ? 'bg-gold/10 text-gold border-gold/40 cursor-not-allowed' :
                                    isSelected ? 'bg-gold text-white border-gold' :
                                    isPremium ? 'bg-transparent border-gold/60 text-gold hover:bg-gold/10' :
                                    'bg-transparent border-gold/30 text-ink hover:border-gold'}`}
                              >
                                {seat.col_index + 1}
                              </button>
                            )
                          })}
                          <span className="w-5 text-xs text-muted text-center flex-shrink-0">{letter}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 mt-6 text-xs text-muted justify-center">
                  <Legend swatch="border border-gold/30 bg-transparent" label="Available" />
                  <Legend swatch="border border-gold/60 bg-transparent" label="Premium" />
                  <Legend swatch="bg-gold" label="Selected" />
                  <Legend swatch="bg-gold/10 border border-gold/40" label="Held" />
                  <Legend swatch="bg-surface-raised" label="Booked" />
                </div>
              </div>

              {message && (
                <p className={`mt-4 text-sm ${message.type === 'error' ? 'text-danger' : 'text-available'}`}>{message.text}</p>
              )}

              {holdExpiresAt && (
                <p className="mt-2 text-sm text-gold font-medium">Held for you — {secondsLeft}s left to confirm</p>
              )}

              <div className="ticket flex items-center justify-between mt-6 p-4">
                <div>
                  <p className="text-xs text-muted">{selected.size} seat{selected.size !== 1 ? 's' : ''} selected</p>
                  <p className="font-seat text-lg text-gold font-semibold">₹{total}</p>
                </div>
                <div className="ticket-divider pl-4 flex gap-2">
                  {!holdExpiresAt && (
                    <button
                      disabled={selected.size === 0 || holding}
                      onClick={holdSelected}
                      className="border border-gold text-gold rounded-lg px-4 py-2 text-sm font-medium hover:bg-gold/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {holding ? 'Holding…' : 'Hold seats'}
                    </button>
                  )}
                  <button
                    disabled={selected.size === 0 || confirming || !holdExpiresAt}
                    onClick={confirmBooking}
                    className="bg-gold text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gold-dim transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {confirming ? 'Confirming…' : 'Confirm booking'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-sm ${swatch}`} />{label}</span>
}