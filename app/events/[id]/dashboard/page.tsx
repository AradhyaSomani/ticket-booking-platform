import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import DeleteEventButton from '@/components/DeleteEventButton'

export default async function Dashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: event, error: eventError } = await supabase.from('events').select('*').eq('id', id).single()

  if (eventError) return <div className="max-w-2xl mx-auto px-4 py-10 text-danger">Could not load this event — {eventError.message}</div>
  if (!event) return notFound()
  if (event.owner_id !== user.id) return <div className="max-w-2xl mx-auto px-4 py-10 text-danger">You do not own this event.</div>

  const { data: attendees, error: attendeesError } = await supabase.rpc('get_event_attendees', { p_event_id: id })
  if (attendeesError) return <div className="max-w-2xl mx-auto px-4 py-10 text-danger">Could not load attendees — {attendeesError.message}</div>

  const totalSeats = event.rows * event.cols
  const sold = attendees?.length ?? 0
  const revenue = sold * event.price

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl">{event.title}</h1>
          <a href={`/events/${id}/checkin`} className="text-sm text-gold hover:underline">Open check-in →</a>
        </div>
        <DeleteEventButton eventId={id} eventTitle={event.title} />
      </div>

      <div className="grid grid-cols-3 gap-3 my-8">
        <Stat label="Seats sold" value={`${sold} / ${totalSeats}`} />
        <Stat label="Revenue" value={`₹${revenue}`} />
        <Stat label="Occupancy" value={`${Math.round((sold / totalSeats) * 100)}%`} />
      </div>

      <h2 className="font-display text-lg mb-3">Attendees</h2>
      <div className="space-y-2">
        {attendees?.map((a: {
          booking_id: string
          seat_label: string
          email: string
          checked_in_at: string | null
          created_at: string
        }) => (
          <div key={a.booking_id} className="ticket flex justify-between items-center px-4 py-3 text-sm">
            <span className="font-seat text-gold">{a.seat_label}</span>
            <span className="flex-1 px-4 truncate">{a.email}</span>
            <span className="text-muted flex-shrink-0">{a.checked_in_at ? 'checked in' : new Date(a.created_at).toLocaleDateString()}</span>
          </div>
        ))}
        {!attendees?.length && <p className="text-muted text-sm">No bookings yet.</p>}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="ticket text-center p-4">
      <p className="font-display text-2xl text-gold">{value}</p>
      <p className="text-xs text-muted mt-1">{label}</p>
    </div>
  )
}