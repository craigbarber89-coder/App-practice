import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { businessConfig } from '@config'

export async function GET(_: NextRequest, { params }: { params: { token: string } }) {
  const supabase = createServiceClient()

  const { data: appointment } = await supabase
    .from('appointments')
    .select('*, client:clients(*)')
    .eq('cancel_token', params.token)
    .maybeSingle()

  if (!appointment) {
    return NextResponse.redirect(new URL('/cancel/invalid', process.env.NEXT_PUBLIC_APP_URL ?? '/'))
  }

  if (appointment.status === 'cancelled') {
    return NextResponse.redirect(new URL('/cancel/already-cancelled', process.env.NEXT_PUBLIC_APP_URL ?? '/'))
  }

  // Check cutoff
  const apptTime = new Date(appointment.scheduled_at)
  const cutoff = new Date(
    apptTime.getTime() - businessConfig.booking.cancellationCutoffHours * 3600_000
  )
  if (new Date() > cutoff) {
    return NextResponse.redirect(new URL('/cancel/too-late', process.env.NEXT_PUBLIC_APP_URL ?? '/'))
  }

  // Cancel it
  await supabase
    .from('appointments')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: 'Client self-cancelled via link',
    })
    .eq('id', appointment.id)

  return NextResponse.redirect(new URL('/cancel/success', process.env.NEXT_PUBLIC_APP_URL ?? '/'))
}
