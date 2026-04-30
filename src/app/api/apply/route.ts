import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { normalisePhone } from '@/lib/twilio'
import { z } from 'zod'

const schema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone: z.string().min(7),
  email: z.string().email().optional().or(z.literal('')),
  pet_name: z.string().min(1),
  pet_breed: z.string().optional(),
  pet_notes: z.string().optional(),
  applicant_message: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please fill in all required fields.' }, { status: 400 })
    }

    const d = parsed.data
    const phone = normalisePhone(d.phone)
    if (!phone) {
      return NextResponse.json({ error: 'Invalid phone number. Please include your area code.' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Check for duplicate application or existing client
    const [{ data: existingApp }, { data: existingClient }] = await Promise.all([
      supabase
        .from('client_applications')
        .select('id, status')
        .eq('phone', phone)
        .eq('status', 'pending')
        .maybeSingle(),
      supabase
        .from('clients')
        .select('id')
        .eq('phone', phone)
        .maybeSingle(),
    ])

    if (existingClient) {
      return NextResponse.json(
        { error: 'An account with this phone number already exists. You can book directly from our booking page.' },
        { status: 409 }
      )
    }

    if (existingApp) {
      return NextResponse.json(
        { error: 'You already have a pending application. We\'ll be in touch soon!' },
        { status: 409 }
      )
    }

    const { data: application, error } = await supabase
      .from('client_applications')
      .insert({
        first_name: d.first_name,
        last_name: d.last_name,
        phone,
        email: d.email || null,
        pet_name: d.pet_name,
        pet_breed: d.pet_breed || null,
        pet_notes: d.pet_notes || null,
        applicant_message: d.applicant_message || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: application.id }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 503 })
  }
}
