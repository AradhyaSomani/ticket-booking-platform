'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null)
  const [checked, setChecked] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setChecked(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="border-b border-hairline sticky top-0 z-10 backdrop-blur bg-bg/90">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/events" className="font-display text-xl tracking-tight">
          Box Office
        </Link>

        <nav className="flex items-center gap-5 text-sm text-muted">
          <Link href="/events" className="hover:text-ink transition-colors">Events</Link>

          {!checked ? null : user ? (
            <>
              <Link href="/bookings" className="hover:text-ink transition-colors">My bookings</Link>
              <Link href="/profile" className="hover:text-ink transition-colors">Profile</Link>
              <Link href="/events/new"
                className="text-bg bg-gold hover:bg-gold-dim transition-colors rounded px-3 py-1.5 font-medium">
                Host an event
              </Link>
              <button onClick={handleLogout} className="hover:text-ink transition-colors">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-ink transition-colors">Log in</Link>
              <Link href="/signup"
                className="text-bg bg-gold hover:bg-gold-dim transition-colors rounded px-3 py-1.5 font-medium">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}