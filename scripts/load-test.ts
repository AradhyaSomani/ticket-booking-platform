import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  const EVENT_ID = process.argv[2]
  const SEAT_ID = process.argv[3]
  const N = 20

  // create N throwaway users (or reuse test accounts) and fire book_seats concurrently
  const attempts = Array.from({ length: N }).map(async (_, i) => {
    const { data, error } = await supabase.rpc('book_seats', {
      p_event_id: EVENT_ID,
      p_seat_ids: [SEAT_ID],
    })
    return { i, ok: !error, error: error?.message }
  })

  const results = await Promise.all(attempts)
  const successes = results.filter(r => r.ok)
  console.log(`${successes.length} succeeded, ${N - successes.length} failed`)
  console.log(results)
}

run()