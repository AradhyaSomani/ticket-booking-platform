import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

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
    return <div className="max-w-5xl mx-auto px-4 py-10 text-danger">Could not load events — {error.message}</div>
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="font-display text-3xl font-bold mb-1">What is playing</h1>
      <p className="text-muted text-sm mb-6">Live seats, locked at the database — never a double booking.</p>

      <form className="flex flex-wrap gap-2 mb-8">
        <input name="q" defaultValue={q} placeholder="Search events"
          className="bg-surface border border-hairline rounded-lg px-3 py-2 text-sm placeholder:text-muted focus:border-gold outline-none transition-colors flex-1 min-w-[160px]" />
        <input name="venue" defaultValue={venue} placeholder="Venue"
          className="bg-surface border border-hairline rounded-lg px-3 py-2 text-sm placeholder:text-muted focus:border-gold outline-none transition-colors w-32" />
        <input name="maxPrice" defaultValue={maxPrice} type="number" placeholder="Max ₹"
          className="bg-surface border border-hairline rounded-lg px-3 py-2 text-sm placeholder:text-muted focus:border-gold outline-none transition-colors w-28" />
        <input name="dateFrom" defaultValue={dateFrom} type="date"
          className="bg-surface border border-hairline rounded-lg px-3 py-2 text-sm focus:border-gold outline-none transition-colors" />
        <button className="bg-gold text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-gold-dim transition-colors">
          Search
        </button>
      </form>

      {!events?.length && (
        <div className="border border-dashed border-hairline rounded-2xl p-12 text-center text-muted">
          Nothing is live right now. Check back soon, or host your own event.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
        {events?.map(ev => (
          <Link key={ev.id} href={`/events/${ev.id}`} className="ticket interactive overflow-hidden group">
            <div className="aspect-[2/3] bg-surface-raised relative overflow-hidden">
              {ev.cover_url ? (
                <img src={ev.cover_url} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-display text-4xl text-gold/40">
                  {ev.title[0]}
                </div>
              )}
              <div className="absolute top-2 right-2 bg-bg/90 backdrop-blur text-gold text-xs font-semibold rounded-full px-2 py-1">
                ₹{ev.price}+
              </div>
            </div>
            <div className="p-3">
              <h2 className="font-semibold text-sm truncate group-hover:text-gold transition-colors">{ev.title}</h2>
              <p className="text-xs text-muted mt-1 truncate">{ev.venue}</p>
              <p className="text-xs text-muted">{new Date(ev.starts_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}