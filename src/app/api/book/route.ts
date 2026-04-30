/**
 * Booking portal submission endpoint.
 * Creates or finds client, creates appointment, notifies owner.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { normalisePhone } from '@/lib/twilio'
import { notifyOwnerNewBooking } from '@/lib/messaging'
import { z } from 'zod'

const bookingSchema = z.object({
  phone: z.string().min(7),
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  pet_name: z.string().min(1).optional(),
  pet_breed: z.string().optional(),
  service_id: z.string().uuid(),
  scheduled_at: z.string().datetime(),
  referred_by_code: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const body = await request.json()

    const parsed = bookingSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const d = parsed.data
    const phone = normalisePhone(d.phone)
    if (!phone) return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })

    // Check for day blocks before proceeding
    const apptDate = new Date(d.scheduled_at)
    const dateStr = apptDate.toISOString().slice(0, 10)
    const { data: daySetting } = await supabase
      .from('day_settings')
      .select('block_type, label')
      .eq('date', dateStr)
      .maybeSingle()

    if (daySetting && daySetting.block_type !== 'none') {
      const hour = apptDate.getUTCHours()
      const blockLabel = daySetting.label || 'unavailable'
      if (daySetting.block_type === 'full') {
        return NextResponse.json({ error: `Sorry, ${dateStr} is not available for bookings (${blockLabel}).` }, { status: 409 })
      }
      if (daySetting.block_type === 'am' && hour < 12) {
        return NextResponse.json({ error: `Sorry, mornings on ${dateStr} are not available (${blockLabel}).` }, { status: 409 })
      }
      if (daySetting.block_type === 'pm' && hour >= 12) {
        return NextResponse.json({ error: `Sorry, afternoons on ${dateStr} are not available (${blockLabel}).` }, { status: 409 })
      }
    }

    // Find existing client by phone
    let { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('phone', phone)
      .maybeSingle()

    if (!client) {
      // New client — require full details
      if (!d.first_name || !d.last_name || !d.pet_name) {
        return NextResponse.json(
          { error: 'New clients must provide first name, last name, and pet name', is_new_client: true },
          { status: 422 }
        )
      }

      let referredBy: string | null = null
      if (d.referred_by_code) {
        const { data: referrer } = await supabase
          .from('clients')
          .select('id')
          .eq('referral_code', d.referred_by_code)
          .maybeSingle()
        referredBy = referrer?.id ?? null
      }

      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert({
          first_name: d.first_name,
          last_name: d.last_name,
          email: d.email ?? null,
          phone,
          pet_name: d.pet_name,
          pet_breed: d.pet_breed ?? null,
          referred_by: referredBy,
        })
        .select()
        .single()

      if (clientError) return NextResponse.json({ error: clientError.message }, { status: 500 })
      client = newClient

      if (referredBy && client) {
        await supabase.from('referrals').insert({
          referrer_client_id: referredBy,
          referred_client_id: client.id,
        })
      }
    }

    // Resolve service details
    const { data: service } = await supabase
      .from('services')
      .select('*')
      .eq('id', d.service_id)
      .single()

    if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 })

    // Create appointment
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .insert({
        client_id: client.id,
        service_id: d.service_id,
        scheduled_at: d.scheduled_at,
        duration_minutes: service.duration_minutes,
        price_charged: service.price,
        booked_via: 'portal',
        status: 'scheduled',
      })
      .select('*, client:clients(*), service:services(*)')
      .single()

    if (apptError) return NextResponse.json({ error: apptError.message }, { status: 500 })

    // Notify owner (fire and forget)
    notifyOwnerNewBooking(appointment as Parameters<typeof notifyOwnerNewBooking>[0]).catch((err) =>
      console.error('Failed to notify owner:', err)
    )

    return NextResponse.json({ appointment, client }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 503 })
  }
}

// Lookup existing client by phone for the booking portal
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')

    if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 })

    const normalised = normalisePhone(phone)
    if (!normalised) return NextResponse.json({ error: 'Invalid phone' }, { status: 400 })

    const { data: client } = await supabase
      .from('clients')
      .select('id, first_name, last_name, email, pet_name, pet_breed')
      .eq('phone', normalised)
      .maybeSingle()

    return NextResponse.json({ client })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 503 })
  }
}
