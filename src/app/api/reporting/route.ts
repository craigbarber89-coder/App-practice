import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(request.url)
  const months = parseInt(searchParams.get('months') ?? '6', 10)

  const from = new Date()
  from.setMonth(from.getMonth() - months)

  const [
    { data: appointments },
    { data: messages },
    { data: referrals },
    { data: reviewClicks },
    { data: clients },
  ] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, scheduled_at, status, price_charged, client_id, booked_via')
      .gte('scheduled_at', from.toISOString()),
    supabase
      .from('scheduled_messages')
      .select('id, created_at, status, message_type')
      .gte('created_at', from.toISOString()),
    supabase
      .from('referrals')
      .select('id, created_at')
      .gte('created_at', from.toISOString()),
    supabase
      .from('review_link_clicks')
      .select('id, clicked_at')
      .gte('clicked_at', from.toISOString()),
    supabase
      .from('clients')
      .select('id, created_at')
      .gte('created_at', from.toISOString()),
  ])

  // Group by month
  const byMonth: Record<
    string,
    {
      month: string
      revenue: number
      appointmentsCompleted: number
      newClients: number
      referralsGenerated: number
      messagesSent: number
    }
  > = {}

  const monthKey = (isoString: string) => isoString.slice(0, 7)

  for (const appt of appointments ?? []) {
    const key = monthKey(appt.scheduled_at)
    if (!byMonth[key]) byMonth[key] = zeroMonth(key)
    if (appt.status === 'completed') {
      byMonth[key].appointmentsCompleted++
      byMonth[key].revenue += appt.price_charged ?? 0
    }
  }

  for (const client of clients ?? []) {
    const key = monthKey(client.created_at)
    if (!byMonth[key]) byMonth[key] = zeroMonth(key)
    byMonth[key].newClients++
  }

  for (const ref of referrals ?? []) {
    const key = monthKey(ref.created_at)
    if (!byMonth[key]) byMonth[key] = zeroMonth(key)
    byMonth[key].referralsGenerated++
  }

  for (const msg of messages ?? []) {
    if (msg.status === 'sent') {
      const key = monthKey(msg.created_at)
      if (!byMonth[key]) byMonth[key] = zeroMonth(key)
      byMonth[key].messagesSent++
    }
  }

  const sorted = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month))

  // Totals
  const totals = sorted.reduce(
    (acc, m) => ({
      revenue: acc.revenue + m.revenue,
      appointmentsCompleted: acc.appointmentsCompleted + m.appointmentsCompleted,
      newClients: acc.newClients + m.newClients,
      referralsGenerated: acc.referralsGenerated + m.referralsGenerated,
      messagesSent: acc.messagesSent + m.messagesSent,
    }),
    { revenue: 0, appointmentsCompleted: 0, newClients: 0, referralsGenerated: 0, messagesSent: 0 }
  )

  return NextResponse.json({
    months: sorted,
    totals,
    reviewClicks: reviewClicks?.length ?? 0,
    pendingMessages:
      messages?.filter((m) => m.status === 'pending').length ?? 0,
    failedMessages:
      messages?.filter((m) => m.status === 'failed').length ?? 0,
  })
}

function zeroMonth(month: string) {
  return {
    month,
    revenue: 0,
    appointmentsCompleted: 0,
    newClients: 0,
    referralsGenerated: 0,
    messagesSent: 0,
  }
}
