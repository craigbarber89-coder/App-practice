import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { normalisePhone } from '@/lib/twilio'
import { z } from 'zod'

const createClientSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().min(7),
  pet_name: z.string().min(1),
  pet_breed: z.string().optional(),
  pet_notes: z.string().optional(),
  referred_by_code: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)
    const archived = searchParams.get('archived') === 'true'
    const q = searchParams.get('q')

    let query = supabase
      .from('clients')
      .select('*')
      .eq('is_archived', archived)
      .order('last_name', { ascending: true })

    if (q) {
      query = query.or(
        `first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,pet_name.ilike.%${q}%`
      )
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const body = await request.json()

    const parsed = createClientSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data
    const phone = normalisePhone(data.phone)
    if (!phone) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    // Look up referrer
    let referredBy: string | null = null
    if (data.referred_by_code) {
      const { data: referrer } = await supabase
        .from('clients')
        .select('id')
        .eq('referral_code', data.referred_by_code)
        .maybeSingle()
      referredBy = referrer?.id ?? null
    }

    const { data: client, error } = await supabase
      .from('clients')
      .insert({
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email ?? null,
        phone,
        pet_name: data.pet_name,
        pet_breed: data.pet_breed ?? null,
        pet_notes: data.pet_notes ?? null,
        referred_by: referredBy,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Record referral
    if (referredBy && client) {
      await supabase.from('referrals').insert({
        referrer_client_id: referredBy,
        referred_client_id: client.id,
      })
    }

    return NextResponse.json(client, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 503 })
  }
}
