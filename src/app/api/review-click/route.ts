/**
 * Tracks when a client clicks the Google review link.
 * Redirects to the actual review URL.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client')
  const appointmentId = searchParams.get('appointment')

  const { data: settings } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'google_review_url')
    .single()

  const reviewUrl = settings?.value
  if (!reviewUrl) {
    return NextResponse.json({ error: 'Review URL not configured' }, { status: 404 })
  }

  // Log click
  if (clientId) {
    await supabase.from('review_link_clicks').insert({
      client_id: clientId,
      appointment_id: appointmentId ?? null,
      ip_address: request.headers.get('x-forwarded-for') ?? null,
    })
  }

  return NextResponse.redirect(reviewUrl)
}
