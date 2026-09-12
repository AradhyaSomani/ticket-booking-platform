'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setSubmitting(false)
    if (error) return setError(error.message)
    setSent(true)
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-24">
      <form onSubmit={handleSubmit} className="ticket p-6 space-y-4">
        <h1 className="font-display text-2xl mb-1">Reset password</h1>
        <p className="text-sm text-muted mb-2">
          {sent
            ? "Check your inbox for a reset link."
            : "Enter your account email and we'll send you a reset link."}
        </p>

        {!sent && (
          <>
            <input className="w-full bg-surface border border-hairline rounded px-3 py-2 text-sm placeholder:text-muted focus:border-gold outline-none transition-colors"
              type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
            {error && <p className="text-sm text-danger">{error}</p>}
            <button disabled={submitting}
              className="w-full bg-gold text-bg rounded px-3 py-2.5 text-sm font-medium hover:bg-gold-dim transition-colors disabled:opacity-50">
              {submitting ? 'Sending…' : 'Send reset link'}
            </button>
          </>
        )}

        <p className="text-xs text-muted text-center pt-2">
          <Link href="/login" className="hover:text-gold transition-colors">Back to log in</Link>
        </p>
      </form>
    </div>
  )
}