import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const NUM_ATTEMPTS = 15

async function main() {
  const eventId = process.argv[2]
  const seatId = process.argv[3]

  if (!eventId || !seatId) {
    console.error('Usage: npx tsx scripts/concurrency-test.ts <event_id> <seat_id>')
    process.exit(1)
  }

  console.log(`Racing ${NUM_ATTEMPTS} users for seat ${seatId} on event ${eventId}...\n`)

  // Admin client to create/clean up throwaway test users
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // 1. Create N throwaway test users
  const testUsers: { email: string; password: string; id: string }[] = []
  for (let i = 0; i < NUM_ATTEMPTS; i++) {
    const email = `concurrency-test-${Date.now()}-${i}@example.com`
    const password = 'test-password-123'
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (error || !data.user) {
      console.error(`Failed to create test user ${i}:`, error?.message)
      process.exit(1)
    }
    testUsers.push({ email, password, id: data.user.id })
  }
  console.log(`Created ${testUsers.length} test users.\n`)

  // 2. For each test user, sign in with their own client, then fire book_seats
  //    all at the same instant using Promise.all — this is the real race.
  const attempts = testUsers.map(async (user, i) => {
    const client = createClient(SUPABASE_URL, ANON_KEY)
    const { error: signInError } = await client.auth.signInWithPassword({
      email: user.email, password: user.password,
    })
    if (signInError) return { i, ok: false, error: `sign-in failed: ${signInError.message}` }

    const { data, error } = await client.rpc('book_seats', {
      p_event_id: eventId,
      p_seat_ids: [seatId],
    })
    return { i, ok: !error, error: error?.message, data }
  })

  const results = await Promise.all(attempts)

  const successes = results.filter(r => r.ok)
  const failures = results.filter(r => !r.ok)

  console.log('--- Results ---')
  results.forEach(r => {
    console.log(`User ${r.i}: ${r.ok ? '✅ BOOKED' : `❌ ${r.error}`}`)
  })

  console.log(`\n${successes.length} succeeded, ${failures.length} failed.`)
  if (successes.length === 1) {
    console.log('✅ PASS — exactly one booking succeeded, as required.')
  } else if (successes.length === 0) {
    console.log('⚠️  No bookings succeeded — check the seat/event IDs are valid and the seat was free before this run.')
  } else {
    console.log('❌ FAIL — more than one booking succeeded! Double-booking occurred.')
  }

  // 3. Clean up: delete the test users (cascades to their bookings via FK)
  console.log('\nCleaning up test users...')
  for (const user of testUsers) {
    await admin.auth.admin.deleteUser(user.id)
  }
  console.log('Done.')
}

main()