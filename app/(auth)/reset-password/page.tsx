'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) return setError('Password must be at least 6 characters')
    if (password !== confirm) return setError("Passwords don't match")

    setSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setSubmitting(false)
    if (error) return setError(error.message)

    setDone(true)
    setTimeout(() => router.push('/login'), 1500)
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-24">
      <form onSubmit={handleSubmit} className="ticket p-6 space-y-4">
        <h1 className="font-display text-2xl mb-1">Set a new password</h1>

        {done ? (
          <p className="text-sm text-available">Password updated. Taking you to log in…</p>
        ) : (
          <>
            <input className="w-full bg-surface border border-hairline rounded px-3 py-2 text-sm placeholder:text-muted focus:border-gold outline-none transition-colors"
              type="password" placeholder="New password" value={password} onChange={e => setPassword(e.target.value)} required />
            <input className="w-full bg-surface border border-hairline rounded px-3 py-2 text-sm placeholder:text-muted focus:border-gold outline-none transition-colors"
              type="password" placeholder="Confirm new password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
            {error && <p className="text-sm text-danger">{error}</p>}
            <button disabled={submitting}
              className="w-full bg-gold text-bg rounded px-3 py-2.5 text-sm font-medium hover:bg-gold-dim transition-colors disabled:opacity-50">
              {submitting ? 'Updating…' : 'Update password'}
            </button>
          </>
        )}
      </form>
    </div>
  )
}