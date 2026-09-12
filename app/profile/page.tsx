'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AuthGuard from '@/components/AuthGuard'

const inputClass = "w-full bg-surface border border-hairline rounded px-3 py-2 text-sm placeholder:text-muted focus:border-gold outline-none transition-colors"

type Profile = {
  id: string
  email: string
  full_name: string | null
  username: string | null
  date_of_birth: string | null
  birthplace: string | null
  phone_number: string | null
  bio: string | null
}

function calculateAge(dob: string): number {
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const hasHadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate())
  if (!hasHadBirthdayThisYear) age -= 1
  return age
}

export default function ProfilePage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState({
    full_name: '', username: '', date_of_birth: '', birthplace: '', phone_number: '', bio: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (cancelled) return
      if (error) {
        setError(error.message)
      } else if (data) {
        setProfile(data)
        setForm({
          full_name: data.full_name ?? '',
          username: data.username ?? '',
          date_of_birth: data.date_of_birth ?? '',
          birthplace: data.birthplace ?? '',
          phone_number: data.phone_number ?? '',
          bio: data.bio ?? '',
        })
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)

    if (form.username && !/^[a-zA-Z0-9_]{3,20}$/.test(form.username)) {
      return setError('Username must be 3-20 characters: letters, numbers, underscores only')
    }
    if (form.phone_number && !/^[+\d][\d\s-]{6,16}$/.test(form.phone_number)) {
      return setError('Enter a valid phone number')
    }
    if (form.date_of_birth) {
      const age = calculateAge(form.date_of_birth)
      if (age < 13) return setError('You must be at least 13 years old')
      if (age > 120) return setError('Enter a valid date of birth')
    }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('profiles').update({
      full_name: form.full_name || null,
      username: form.username || null,
      date_of_birth: form.date_of_birth || null,
      birthplace: form.birthplace || null,
      phone_number: form.phone_number || null,
      bio: form.bio || null,
    }).eq('id', user!.id)
    setSaving(false)

    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        return setError('That username is already taken')
      }
      return setError(error.message)
    }
    setSaved(true)
    setProfile(prev => prev ? { ...prev, ...form } : prev)
  }

  const currentAge = form.date_of_birth ? calculateAge(form.date_of_birth) : null

  return (
    <AuthGuard>
      <div className="max-w-lg mx-auto px-4 py-10">
        <h1 className="font-display text-2xl mb-1">Your profile</h1>
        <p className="text-sm text-muted mb-8">This is how organisers and other attendees will see you.</p>

        {loading ? (
          <div className="ticket h-64 animate-pulse bg-surface-raised/40" />
        ) : (
          <form onSubmit={handleSave} className="ticket p-6 space-y-4">
            <div>
              <label className="text-xs text-muted">Signed in as</label>
              <p className="text-sm mt-1 font-seat text-gold">{profile?.email}</p>
            </div>

            <div>
              <label className="text-xs text-muted">Full name</label>
              <input className={inputClass} placeholder="Full name"
                value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
            </div>

            <div>
              <label className="text-xs text-muted">Username</label>
              <input className={inputClass} placeholder="username"
                value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted">Date of birth</label>
                <input className={inputClass} type="date"
                  value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} />
                {currentAge !== null && (
                  <p className="text-xs text-gold mt-1">Age: {currentAge}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-muted">Place of birth</label>
                <input className={inputClass} placeholder="City, Country"
                  value={form.birthplace} onChange={e => setForm({ ...form, birthplace: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted">Phone number</label>
              <input className={inputClass} placeholder="+91 98765 43210"
                value={form.phone_number} onChange={e => setForm({ ...form, phone_number: e.target.value })} />
            </div>

            <div>
              <label className="text-xs text-muted">About you</label>
              <textarea className={inputClass} rows={3} placeholder="Anything else you'd like to share"
                value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}
            {saved && <p className="text-sm text-available">Profile saved.</p>}

            <button disabled={saving}
              className="w-full bg-gold text-bg rounded px-3 py-2.5 text-sm font-medium hover:bg-gold-dim transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        )}
      </div>
    </AuthGuard>
  )
}