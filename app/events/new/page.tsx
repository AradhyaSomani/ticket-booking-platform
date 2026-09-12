'use client'
import { useState } from 'react'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import AuthGuard from '@/components/AuthGuard'

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(120),
  description: z.string().optional(),
  venue: z.string().min(1, 'Venue is required'),
  starts_at: z.string().refine(v => new Date(v) > new Date(), 'Date must be in the future'),
  price: z.coerce.number().min(0, 'Price cannot be negative'),
  rows: z.coerce.number().int().min(1).max(20, 'Rows must be 1-20'),
  cols: z.coerce.number().int().min(1).max(20, 'Columns must be 1-20'),
  premiumRows: z.string().optional(),
})

const inputClass = "w-full bg-surface border border-hairline rounded px-3 py-2 text-sm placeholder:text-muted focus:border-gold outline-none transition-colors"

export default function NewEvent() {
  const [form, setForm] = useState({
    title: '', description: '', venue: '', starts_at: '',
    price: '0', rows: '10', cols: '10', premiumRows: '',
  })
  const [cover, setCover] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    const parsed = schema.safeParse(form)
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      parsed.error.issues.forEach(i => { fieldErrors[i.path[0] as string] = i.message })
      setErrors(fieldErrors)
      return
    }

    setSubmitting(true)
    const supabase = createClient()
    const premiumRows = parsed.data.premiumRows
      ? parsed.data.premiumRows.split(',').map(r => r.trim().toUpperCase()).filter(Boolean)
      : []

    const { data: eventId, error } = await supabase.rpc('create_event_with_seats', {
      p_title: parsed.data.title,
      p_description: parsed.data.description ?? '',
      p_venue: parsed.data.venue,
      p_starts_at: new Date(parsed.data.starts_at).toISOString(),
      p_price: parsed.data.price,
      p_rows: parsed.data.rows,
      p_cols: parsed.data.cols,
      p_premium_rows: premiumRows,
    })

    if (error) {
      setSubmitting(false)
      return setErrors({ form: error.message })
    }

    if (cover) {
      const { data: { user } } = await supabase.auth.getUser()
      const path = `${user!.id}/${eventId}.jpg`
      const { error: uploadError } = await supabase.storage.from('event-covers').upload(path, cover, { upsert: true })
      if (!uploadError) {
        const { data } = supabase.storage.from('event-covers').getPublicUrl(path)
        await supabase.from('events').update({ cover_url: data.publicUrl }).eq('id', eventId)
      }
    }

    setSubmitting(false)
    router.push(`/events/${eventId}`)
  }

  return (
    <AuthGuard>
      <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-4 py-10 space-y-4">
        <h1 className="font-display text-2xl mb-6">Host an event</h1>

        <div>
          <input className={inputClass} placeholder="Event title"
            value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          {errors.title && <p className="text-xs text-danger mt-1">{errors.title}</p>}
        </div>

        <div>
          <input className={inputClass} placeholder="Venue"
            value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} />
          {errors.venue && <p className="text-xs text-danger mt-1">{errors.venue}</p>}
        </div>

        <textarea className={inputClass} placeholder="Description" rows={3}
          value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />

        <div>
          <input className={inputClass} type="datetime-local"
            value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} />
          {errors.starts_at && <p className="text-xs text-danger mt-1">{errors.starts_at}</p>}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted">Price (₹)</label>
            <input className={inputClass} type="number" step="0.01"
              value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
            {errors.price && <p className="text-xs text-danger mt-1">{errors.price}</p>}
          </div>
          <div>
            <label className="text-xs text-muted">Rows</label>
            <input className={inputClass} type="number"
              value={form.rows} onChange={e => setForm({ ...form, rows: e.target.value })} />
            {errors.rows && <p className="text-xs text-danger mt-1">{errors.rows}</p>}
          </div>
          <div>
            <label className="text-xs text-muted">Columns</label>
            <input className={inputClass} type="number"
              value={form.cols} onChange={e => setForm({ ...form, cols: e.target.value })} />
            {errors.cols && <p className="text-xs text-danger mt-1">{errors.cols}</p>}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted">Premium rows (comma-separated, e.g. A,B)</label>
          <input className={inputClass} placeholder="A,B"
            value={form.premiumRows} onChange={e => setForm({ ...form, premiumRows: e.target.value })} />
          <p className="text-xs text-muted mt-1">Priced at 1.5× the base price.</p>
        </div>

        <div>
          <label className="text-xs text-muted">Cover image (optional)</label>
          <input type="file" accept="image/*" className="w-full text-sm text-muted mt-1"
            onChange={e => setCover(e.target.files?.[0] ?? null)} />
        </div>

        {errors.form && <p className="text-sm text-danger">{errors.form}</p>}

        <button disabled={submitting}
          className="w-full bg-gold text-bg rounded px-3 py-2.5 text-sm font-medium hover:bg-gold-dim transition-colors disabled:opacity-50">
          {submitting ? 'Creating…' : 'Create event'}
        </button>
      </form>
    </AuthGuard>
  )
}