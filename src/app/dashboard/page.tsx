import { createServiceClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

export default async function DashboardOverview() {
  const supabase = createServiceClient()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()

  const [
    { data: todayAppts },
    { data: monthAppts },
    { data: recentClients },
    { data: failedMessages },
    { count: totalClients },
  ] = await Promise.all([
    supabase
      .from('appointments')
      .select('*, client:clients(first_name, last_name, pet_name), service:services(name)')
      .gte('scheduled_at', todayStart)
      .lt('scheduled_at', todayEnd)
      .neq('status', 'cancelled')
      .order('scheduled_at', { ascending: true }),
    supabase
      .from('appointments')
      .select('price_charged, status')
      .gte('scheduled_at', monthStart)
      .eq('status', 'completed'),
    supabase
      .from('clients')
      .select('id, first_name, last_name, pet_name, created_at')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('scheduled_messages')
      .select('id, message_type, error_message, created_at, recipient_name')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('is_archived', false),
  ])

  const monthRevenue = (monthAppts ?? []).reduce((sum, a) => sum + (a.price_charged ?? 0), 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Overview</h1>

      {/* Failed messages alert */}
      {(failedMessages ?? []).length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-red-800 dark:text-red-400 mb-2">
            ⚠️ {failedMessages!.length} failed message{failedMessages!.length !== 1 ? 's' : ''} — action required
          </h2>
          <ul className="text-xs text-red-700 dark:text-red-300 space-y-1">
            {failedMessages!.map((m) => (
              <li key={m.id}>
                {m.recipient_name} — {m.message_type.replace(/_/g, ' ')} — {m.error_message}
              </li>
            ))}
          </ul>
          <Link href="/dashboard/messages" className="text-xs text-red-700 dark:text-red-400 underline mt-2 inline-block">
            View all messages →
          </Link>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/dashboard/revenue" className="block group">
          <StatCard label="This Month Revenue" value={formatCurrency(monthRevenue)} linkHint="View breakdown →" />
        </Link>
        <StatCard label="Appointments This Month" value={String(monthAppts?.length ?? 0)} />
        <StatCard label="Total Clients" value={String(totalClients ?? 0)} />
        <StatCard label="Today's Appointments" value={String(todayAppts?.length ?? 0)} />
      </div>

      {/* Today's schedule */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Today&apos;s Schedule</h2>
          <Link href="/dashboard/appointments" className="text-sm text-brand-600 dark:text-brand-400 hover:underline">
            View all →
          </Link>
        </div>

        {(todayAppts ?? []).length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No appointments today.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {todayAppts!.map((appt) => (
              <li key={appt.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {(appt.client as { first_name: string; last_name: string } | null)?.first_name}{' '}
                    {(appt.client as { first_name: string; last_name: string } | null)?.last_name}
                    <span className="text-gray-500 dark:text-gray-400 font-normal">
                      {' '}— {(appt.client as { pet_name: string } | null)?.pet_name}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(appt.service as { name: string } | null)?.name ?? appt.service_description ?? 'Grooming'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium dark:text-gray-200">
                    {new Date(appt.scheduled_at).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                  <span className={`badge-${appt.status}`}>
                    {appt.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent clients */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Recent Clients</h2>
          <Link href="/dashboard/clients" className="text-sm text-brand-600 dark:text-brand-400 hover:underline">
            View all →
          </Link>
        </div>
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {(recentClients ?? []).map((client) => (
            <li key={client.id} className="py-3">
              <Link
                href={`/dashboard/clients/${client.id}`}
                className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 -mx-2 px-2 rounded-lg transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {client.first_name} {client.last_name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{client.pet_name}</p>
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {new Date(client.created_at).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function StatCard({ label, value, linkHint }: { label: string; value: string; linkHint?: string }) {
  return (
    <div className="card group-hover:ring-2 group-hover:ring-brand-400 transition-shadow">
      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      {linkHint && (
        <p className="text-xs text-brand-600 dark:text-brand-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {linkHint}
        </p>
      )}
    </div>
  )
}
