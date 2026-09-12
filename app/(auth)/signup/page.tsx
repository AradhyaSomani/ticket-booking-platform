'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) return setError('Password must be at least 6 characters')

    setSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email, password })
    setSubmitting(false)
    if (error) return setError(error.message)
    router.push('/events')
    router.refresh()
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-24">
      <form onSubmit={handleSubmit} className="ticket p-6 space-y-4">
        <h1 className="font-display text-2xl mb-1">Create your account</h1>
        <p className="text-sm text-muted mb-2">Book seats or host your own events.</p>

        <input className="w-full bg-surface border border-hairline rounded px-3 py-2 text-sm placeholder:text-muted focus:border-gold outline-none transition-colors"
          type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input className="w-full bg-surface border border-hairline rounded px-3 py-2 text-sm placeholder:text-muted focus:border-gold outline-none transition-colors"
          type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />

        {error && <p className="text-sm text-danger">{error}</p>}

        <button disabled={submitting}
          className="w-full bg-gold text-bg rounded px-3 py-2.5 text-sm font-medium hover:bg-gold-dim transition-colors disabled:opacity-50">
          {submitting ? 'Creating account…' : 'Sign up'}
        </button>

        <p className="text-xs text-muted text-center pt-2">
          Already have an account? <Link href="/login" className="text-gold hover:underline">Log in</Link>
        </p>
      </form>
    </div>
  )
}