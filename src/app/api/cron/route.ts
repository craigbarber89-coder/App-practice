/**
 * Cron endpoint — called every minute via Vercel Cron or external scheduler.
 * Processes pending messages and schedules rebooking reminders.
 * Protected by CRON_SECRET header.
 */
import { NextRequest, NextResponse } from 'next/server'
import { processPendingMessages, scheduleRebookingReminders } from '@/lib/messaging'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [messageResult] = await Promise.allSettled([
    processPendingMessages(),
    // Rebooking reminders only need to run once per day
    shouldRunDailyTasks() ? scheduleRebookingReminders() : Promise.resolve(),
  ])

  const result = messageResult.status === 'fulfilled' ? messageResult.value : { processed: 0, failed: 0 }

  return NextResponse.json({ ok: true, ...result })
}

function shouldRunDailyTasks() {
  // Run daily tasks only at the top of the hour between 8–9 AM UTC
  const now = new Date()
  return now.getUTCHours() === 8 && now.getUTCMinutes() < 5
}
