import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Image from 'next/image'

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; venue?: string; maxPrice?: string; dateFrom?: string }>
}) {
  const { q, venue, maxPrice, dateFrom } = await searchParams
  const supabase = await createClient()

  let query = supabase.from('events').select('*').gt('starts_at', new Date().toISOString())
  if (q) query = query.ilike('title', `%${q}%`)
  if (venue) query = query.ilike('venue', `%${venue}%`)
  if (maxPrice) query = query.lte('price', Number(maxPrice))
  if (dateFrom) query = query.gte('starts_at', dateFrom)
  query = query.order('starts_at', { ascending: true })

  const { data: events, error } = await query

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <p className="text-danger">Could not load events — {error.message}</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-14">
      <div className="mb-10">
        <p className="text-xs text-gold tracking-wide mb-2">Live seat map · instant confirmation</p>
        <h1 className="font-display text-4xl leading-tight">What is on</h1>
        <p className="text-muted text-sm mt-2 max-w-md">
          Every seat is claimed the moment it is confirmed — locked at the database, not just the screen. No two people ever get the same seat.
        </p>
      </div>

      <form className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-8">
        <input name="q" defaultValue={q} placeholder="Search title"
          className="bg-surface border border-hairline rounded px-3 py-2 text-sm placeholder:text-muted focus:border-gold outline-none transition-colors" />
        <input name="venue" defaultValue={venue} placeholder="Venue"
          className="bg-surface border border-hairline rounded px-3 py-2 text-sm placeholder:text-muted focus:border-gold outline-none transition-colors" />
        <input name="maxPrice" defaultValue={maxPrice} type="number" placeholder="Max price"
          className="bg-surface border border-hairline rounded px-3 py-2 text-sm placeholder:text-muted focus:border-gold outline-none transition-colors" />
        <input name="dateFrom" defaultValue={dateFrom} type="date"
          className="bg-surface border border-hairline rounded px-3 py-2 text-sm focus:border-gold outline-none transition-colors" />
        <button className="col-span-2 sm:col-span-4 bg-gold text-bg rounded px-3 py-2 text-sm font-medium hover:bg-gold-dim transition-colors">
          Filter
        </button>
      </form>

      {!events?.length && (
        <div className="border border-dashed border-hairline rounded-md p-10 text-center text-muted">
          Nothing is booked in yet. Check back soon, or host your own.
        </div>
      )}

      <div className="space-y-4">
        {events?.map(ev => (
          <Link key={ev.id} href={`/events/${ev.id}`} className="ticket interactive flex gap-4 p-5 group">
            {ev.cover_url ? (
              <img src={ev.cover_url} className="w-20 h-20 object-cover rounded flex-shrink-0" alt="" />
            ) : (
              <div className="w-20 h-20 rounded flex-shrink-0 bg-surface-raised flex items-center justify-center font-display text-2xl text-gold/60">
                {ev.title[0]}
              </div>
          )}
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-lg group-hover:text-gold transition-colors truncate">{ev.title}</h2>
              <p className="text-sm text-muted mt-0.5">{ev.venue}</p>
              <p className="text-sm text-muted">{new Date(ev.starts_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
            </div>
            <div className="ticket-divider pl-4 flex flex-col justify-center items-end flex-shrink-0">
              <span className="font-seat text-gold text-lg">₹{ev.price}</span>
              <span className="text-xs text-muted">onwards</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}