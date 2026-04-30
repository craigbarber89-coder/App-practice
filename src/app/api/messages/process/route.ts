/**
 * Manually trigger message processing (useful in local dev where cron isn't running).
 * Calls the same logic as the cron endpoint but without the secret requirement.
 * Protected by auth — only accessible when logged in.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { processPendingMessages } from '@/lib/messaging'

export async function POST() {
  try {
    // Verify auth
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const result = await processPendingMessages()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 503 })
  }
}
