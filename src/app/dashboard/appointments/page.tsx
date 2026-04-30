'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { formatInBusinessTz, formatCurrency } from '@/lib/utils'
import type { Appointment, Client, Service } from '@/types'
import AppointmentFormModal from '@/components/dashboard/AppointmentFormModal'
import CalendarView from '@/components/dashboard/CalendarView'

type ApptWithRelations = Appointment & { client: Client; service: Service | null }

const TABS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'no_show', label: 'No Show' },
  { key: 'all', label: 'All' },
] as const

type TabKey = typeof TABS[number]['key']
type ViewMode = 'calendar' | 'list'

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<ApptWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('upcoming')
  const [viewMode, setViewMode] = useState<ViewMode>('calendar')
  const [showAddModal, setShowAddModal] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)

  const fetchAppointments = useCallback(async () => {
    setLoading(true)

    if (activeTab === 'upcoming' || viewMode === 'calendar') {
      if (viewMode === 'calendar') {
        const res = await fetch('/api/appointments')
        const data = await res.json().catch(() => [])
        setAppointments(Array.isArray(data) ? data : [])
      } else {
        const [scheduledRes, confirmedRes] = await Promise.all([
          fetch('/api/appointments?status=scheduled'),
          fetch('/api/appointments?status=confirmed'),
        ])
        const [scheduled, confirmed] = await Promise.all([
          scheduledRes.json().catch(() => []),
          confirmedRes.json().catch(() => []),
        ])
        const merged = [
          ...(Array.isArray(scheduled) ? scheduled : []),
          ...(Array.isArray(confirmed) ? confirmed : []),
        ].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
        setAppointments(merged)
      }
    } else {
      const params = new URLSearchParams()
      if (activeTab !== 'all') params.set('status', activeTab)
      const res = await fetch(`/api/appointments?${params}`)
      const data = await res.json().catch(() => [])
      setAppointments(Array.isArray(data) ? data : [])
    }

    setLoading(false)
  }, [activeTab, viewMode])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])

  async function updateStatus(id: string, status: Appointment['status']) {
    setUpdating(id)
    await fetch(`/api/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await fetchAppointments()
    setUpdating(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Appointments</h1>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg ring-1 ring-gray-300 dark:ring-gray-600 overflow-hidden">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-brand-600 text-white dark:bg-brand-500'
                  : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              📅 Calendar
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${
                viewMode === 'list'
                  ? 'bg-brand-600 text-white dark:bg-brand-500'
                  : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              ☰ List
            </button>
          </div>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            + New Appointment
          </button>
        </div>
      </div>

      {/* Calendar view */}
      {viewMode === 'calendar' && !loading && (
        <CalendarView
          appointments={appointments}
          onStatusChange={updateStatus}
          onNewAppointment={() => setShowAddModal(true)}
          updating={updating}
        />
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <>
          <div className="flex gap-1 flex-wrap">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === key
                    ? 'bg-brand-600 text-white dark:bg-brand-500'
                    : 'bg-white text-gray-600 ring-1 ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="card p-0 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</div>
            ) : appointments.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {activeTab === 'upcoming' ? 'No upcoming appointments.' : 'No appointments found.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date & Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Client / Pet</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Service</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Price</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-900">
                    {appointments.map((appt) => (
                      <tr key={appt.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {formatInBusinessTz(appt.scheduled_at)}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/clients/${appt.client_id}`}
                            className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
                          >
                            {appt.client?.first_name} {appt.client?.last_name}
                          </Link>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{appt.client?.pet_name}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {appt.service?.name ?? appt.service_description ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium dark:text-gray-200">
                          {appt.price_charged != null ? formatCurrency(appt.price_charged) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`badge-${appt.status}`}>
                            {appt.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-2 justify-end flex-wrap">
                            {appt.status === 'scheduled' && (
                              <>
                                <button
                                  disabled={updating === appt.id}
                                  onClick={() => updateStatus(appt.id, 'confirmed')}
                                  className="text-xs btn-secondary py-1 px-2"
                                >
                                  Confirm
                                </button>
                                <button
                                  disabled={updating === appt.id}
                                  onClick={() => updateStatus(appt.id, 'cancelled')}
                                  className="text-xs text-red-600 dark:text-red-400 hover:underline"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                            {appt.status === 'confirmed' && (
                              <>
                                <button
                                  disabled={updating === appt.id}
                                  onClick={() => updateStatus(appt.id, 'completed')}
                                  className="text-xs btn-primary py-1 px-2"
                                >
                                  Mark Complete
                                </button>
                                <button
                                  disabled={updating === appt.id}
                                  onClick={() => updateStatus(appt.id, 'no_show')}
                                  className="text-xs text-orange-600 dark:text-orange-400 hover:underline"
                                >
                                  No Show
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {loading && viewMode === 'calendar' && (
        <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</div>
      )}

      {showAddModal && (
        <AppointmentFormModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => { setShowAddModal(false); fetchAppointments() }}
        />
      )}
    </div>
  )
}
