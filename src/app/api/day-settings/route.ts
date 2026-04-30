import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const upsertSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().nullable().optional(),
  block_type: z.enum(['none', 'full', 'am', 'pm']).default('none'),
  label: z.string().nullable().optional(),
})

/** GET /api/day-settings?from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    let query = supabase.from('day_settings').select('*')
    if (from) query = query.gte('date', from)
    if (to) query = query.lte('date', to)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 503 })
  }
}

/** PUT /api/day-settings — upsert a single day */
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const body = await request.json()
    const parsed = upsertSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { date, note, block_type, label } = parsed.data

    // If everything is cleared, delete the row instead of storing a blank record
    if (!note && block_type === 'none' && !label) {
      await supabase.from('day_settings').delete().eq('date', date)
      return NextResponse.json({ ok: true, deleted: true })
    }

    const { data, error } = await supabase
      .from('day_settings')
      .upsert({ date, note: note ?? null, block_type, label: label ?? null })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 503 })
  }
}

/** DELETE /api/day-settings?date=YYYY-MM-DD */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

    await supabase.from('day_settings').delete().eq('date', date)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 503 })
  }
}
