'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function DeleteEventButton({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.from('events').delete().eq('id', eventId)
    setDeleting(false)
    if (error) return setError(error.message)
    router.push('/events')
    router.refresh()
  }

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)}
        className="text-xs text-danger border border-danger/50 rounded px-3 py-1.5 hover:bg-danger/10 transition-colors">
        Delete event
      </button>
    )
  }

  return (
    <div className="ticket p-4 border-danger/40">
      <p className="text-sm">Permanently delete &quot;{eventTitle}&quot;? This also cancels all bookings for it.</p>
      {error && <p className="text-sm text-danger mt-2">{error}</p>}
      <div className="flex gap-2 mt-3">
        <button disabled={deleting} onClick={handleDelete}
          className="text-xs bg-danger text-ink rounded px-3 py-1.5 hover:bg-danger/80 transition-colors disabled:opacity-50">
          {deleting ? 'Deleting…' : 'Yes, delete permanently'}
        </button>
        <button disabled={deleting} onClick={() => setConfirming(false)}
          className="text-xs border border-hairline rounded px-3 py-1.5 hover:border-gold/40 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}