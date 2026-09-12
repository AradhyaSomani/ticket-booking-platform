'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (error) return setError(error.message)
    router.push('/events')
    router.refresh()
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-24">
      <form onSubmit={handleSubmit} className="ticket p-6 space-y-4">
        <h1 className="font-display text-2xl mb-1">Welcome back</h1>
        <p className="text-sm text-muted mb-2">Log in to book seats or manage your events.</p>

        <input className="w-full bg-surface border border-hairline rounded px-3 py-2 text-sm placeholder:text-muted focus:border-gold outline-none transition-colors"
          type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input className="w-full bg-surface border border-hairline rounded px-3 py-2 text-sm placeholder:text-muted focus:border-gold outline-none transition-colors"
          type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />

        <div className="text-right -mt-2">
          <Link href="/forgot-password" className="text-xs text-muted hover:text-gold transition-colors">
            Forgot password?
          </Link>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button disabled={submitting}
          className="w-full bg-gold text-bg rounded px-3 py-2.5 text-sm font-medium hover:bg-gold-dim transition-colors disabled:opacity-50">
          {submitting ? 'Logging in…' : 'Log in'}
        </button>

        <p className="text-xs text-muted text-center pt-2">
          New here? <Link href="/signup" className="text-gold hover:underline">Create an account</Link>
        </p>
      </form>
    </div>
  )
}