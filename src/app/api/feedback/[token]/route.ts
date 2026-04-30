/**
 * Handles thumbs up / thumbs down feedback responses from clients.
 * GET /api/feedback/[token]?response=positive|negative
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { scheduleReviewRequest, alertOwnerNegativeFeedback } from '@/lib/messaging'

export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(request.url)
  const response = searchParams.get('response') as 'positive' | 'negative' | null

  if (!response || !['positive', 'negative'].includes(response)) {
    return NextResponse.redirect(
      new URL('/feedback/invalid', process.env.NEXT_PUBLIC_APP_URL ?? '/')
    )
  }

  const { data: feedback, error } = await supabase
    .from('feedback_responses')
    .select('*, appointment:appointments(*, client:clients(*))')
    .eq('response_token', params.token)
    .maybeSingle()

  if (error || !feedback) {
    return NextResponse.redirect(
      new URL('/feedback/invalid', process.env.NEXT_PUBLIC_APP_URL ?? '/')
    )
  }

  // Idempotent — if already responded, just redirect
  if (feedback.responded_at) {
    return NextResponse.redirect(
      new URL(`/feedback/${response}`, process.env.NEXT_PUBLIC_APP_URL ?? '/')
    )
  }

  // Record response
  await supabase
    .from('feedback_responses')
    .update({
      sentiment: response,
      responded_at: new Date().toISOString(),
      ip_address: request.headers.get('x-forwarded-for') ?? null,
    })
    .eq('id', feedback.id)

  const appointment = feedback.appointment as Parameters<typeof scheduleReviewRequest>[0] | null
  if (!appointment) {
    return NextResponse.redirect(new URL(`/feedback/${response}`, process.env.NEXT_PUBLIC_APP_URL ?? '/'))
  }

  if (response === 'positive') {
    scheduleReviewRequest(appointment).catch((err) =>
      console.error('Failed to schedule review request:', err)
    )
  } else {
    alertOwnerNegativeFeedback(appointment).catch((err) =>
      console.error('Failed to alert owner of negative feedback:', err)
    )
  }

  return NextResponse.redirect(
    new URL(`/feedback/${response}`, process.env.NEXT_PUBLIC_APP_URL ?? '/')
  )
}
