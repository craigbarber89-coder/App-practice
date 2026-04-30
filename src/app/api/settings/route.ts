import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('settings').select('key, value')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const map: Record<string, string | null> = {}
  for (const row of data ?? []) map[row.key] = row.value
  return NextResponse.json(map)
}

export async function PATCH(request: NextRequest) {
  const supabase = createServiceClient()
  const body: Record<string, string> = await request.json()

  const updates = Object.entries(body).map(([key, value]) => ({ key, value }))

  for (const { key, value } of updates) {
    await supabase
      .from('settings')
      .upsert({ key, value, updated_at: new Date().toISOString() })
  }

  return NextResponse.json({ ok: true })
}
