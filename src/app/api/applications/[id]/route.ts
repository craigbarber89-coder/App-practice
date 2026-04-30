import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Auth check
    const authClient = createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createServiceClient()
    const body = await request.json()
    const { action, admin_notes } = body // action: 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 })
    }

    // Fetch the application
    const { data: app, error: fetchErr } = await supabase
      .from('client_applications')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchErr || !app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    if (app.status !== 'pending') {
      return NextResponse.json({ error: `Application is already ${app.status}` }, { status: 409 })
    }

    if (action === 'reject') {
      const { data, error } = await supabase
        .from('client_applications')
        .update({
          status: 'rejected',
          admin_notes: admin_notes ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', params.id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }

    // ── APPROVE ──────────────────────────────────────────────────────────────
    // Check if a client with this phone already exists (rare but possible)
    let clientId: string

    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('phone', app.phone)
      .maybeSingle()

    if (existingClient) {
      clientId = existingClient.id
    } else {
      // Create the client record
      const { data: newClient, error: clientErr } = await supabase
        .from('clients')
        .insert({
          first_name: app.first_name,
          last_name: app.last_name,
          phone: app.phone,
          email: app.email ?? null,
          pet_name: app.pet_name,
          pet_breed: app.pet_breed ?? null,
          pet_notes: app.pet_notes ?? null,
        })
        .select()
        .single()

      if (clientErr || !newClient) {
        return NextResponse.json({ error: clientErr?.message ?? 'Failed to create client' }, { status: 500 })
      }
      clientId = newClient.id
    }

    // Mark application approved
    const { data, error: updateErr } = await supabase
      .from('client_applications')
      .update({
        status: 'approved',
        client_id: clientId,
        admin_notes: admin_notes ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single()

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    return NextResponse.json({ ...data, client_id: clientId })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 503 })
  }
}
