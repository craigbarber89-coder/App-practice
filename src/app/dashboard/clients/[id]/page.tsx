'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { formatCurrency, formatInBusinessTz } from '@/lib/utils'
import type { Client, Appointment } from '@/types'
import ClientFormModal from '@/components/dashboard/ClientFormModal'
import AppointmentFormModal from '@/components/dashboard/AppointmentFormModal'
import SendMessagePanel from '@/components/dashboard/SendMessagePanel'

interface ClientDetail extends Client {
  appointments: (Appointment & { service: { name: string } | null })[]
  referrals_made: { id: string; referred: { first_name: string; last_name: string } }[]
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [client, setClient] = useState<ClientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showApptModal, setShowApptModal] = useState(false)

  async function fetchClient() {
    setLoading(true)
    const res = await fetch(`/api/clients/${id}`)
    const data = await res.json()
    setClient(data)
    setLoading(false)
  }

  useEffect(() => { fetchClient() }, [id])

  async function handleArchive() {
    if (!confirm(`Archive ${client?.first_name}? They won't appear in the main list.`)) return
    await fetch(`/api/clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_archived: true }),
    })
    router.push('/dashboard/clients')
  }

  if (loading) return <div className="p-8 text-sm text-gray-500 dark:text-gray-400">Loading…</div>
  if (!client) return <div className="p-8 text-sm text-red-600 dark:text-red-400">Client not found.</div>

  const sortedAppts = [...(client.appointments ?? [])].sort(
    (a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
  )

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {client.first_name} {client.last_name}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{client.pet_name} {client.pet_breed ? `(${client.pet_breed})` : ''}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowApptModal(true)} className="btn-primary">
            + Book Appointment
          </button>
          <button onClick={() => setShowEditModal(true)} className="btn-secondary">
            Edit
          </button>
          <button onClick={handleArchive} className="btn-danger">
            Archive
          </button>
        </div>
      </div>

      {/* Contact & Pet Info */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Contact</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Phone</dt>
              <dd className="font-medium dark:text-gray-100">{client.phone}</dd>
            </div>
            {client.email && (
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Email</dt>
                <dd className="font-medium dark:text-gray-100">{client.email}</dd>
              </div>
            )}
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Client since</dt>
              <dd className="dark:text-gray-200">{formatInBusinessTz(client.created_at, 'MMM d, yyyy')}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Lifetime revenue</dt>
              <dd className="font-bold text-green-700 dark:text-green-400">{formatCurrency(client.lifetime_revenue)}</dd>
            </div>
          </dl>
        </div>
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Pet Info</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Name</dt>
              <dd className="font-medium dark:text-gray-100">{client.pet_name}</dd>
            </div>
            {client.pet_breed && (
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Breed</dt>
                <dd className="dark:text-gray-200">{client.pet_breed}</dd>
              </div>
            )}
            {client.pet_notes && (
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Notes</dt>
                <dd className="text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 rounded px-2 py-1 mt-1">
                  {client.pet_notes}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Send message */}
      <SendMessagePanel client={client} />

      {/* Referrals */}
      {(client.referrals_made ?? []).length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Referrals ({client.referrals_made.length})
          </h2>
          <ul className="text-sm space-y-1">
            {client.referrals_made.map((r) => (
              <li key={r.id} className="text-gray-700 dark:text-gray-300">
                {r.referred.first_name} {r.referred.last_name}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Referral link:{' '}
            <span className="font-mono text-gray-700 dark:text-gray-300">/book?ref={client.referral_code}</span>
          </p>
        </div>
      )}

      {/* Appointment history */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Appointment History ({sortedAppts.length})
        </h2>
        {sortedAppts.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No appointments yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {sortedAppts.map((appt) => (
              <li key={appt.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium dark:text-gray-100">
                    {formatInBusinessTz(appt.scheduled_at, 'MMM d, yyyy h:mm a')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {appt.service?.name ?? appt.service_description ?? 'Grooming'}
                  </p>
                  {appt.notes && <p className="text-xs text-gray-500 dark:text-gray-400 italic">{appt.notes}</p>}
                </div>
                <div className="text-right shrink-0">
                  {appt.price_charged != null && (
                    <p className="text-sm font-medium dark:text-gray-200">{formatCurrency(appt.price_charged)}</p>
                  )}
                  <span className={`badge-${appt.status}`}>{appt.status}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showEditModal && (
        <ClientFormModal
          client={client}
          onClose={() => setShowEditModal(false)}
          onSaved={() => { setShowEditModal(false); fetchClient() }}
        />
      )}

      {showApptModal && (
        <AppointmentFormModal
          defaultClientId={client.id}
          onClose={() => setShowApptModal(false)}
          onSaved={() => { setShowApptModal(false); fetchClient() }}
        />
      )}
    </div>
  )
}
