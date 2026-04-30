'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { formatCurrency, formatDateInBusinessTz } from '@/lib/utils'
import type { Client } from '@/types'
import ClientFormModal from '@/components/dashboard/ClientFormModal'

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  const fetchClients = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ archived: String(showArchived) })
    if (search) params.set('q', search)
    const res = await fetch(`/api/clients?${params}`)
    const data = await res.json().catch(() => [])
    setClients(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [search, showArchived])

  useEffect(() => {
    const t = setTimeout(fetchClients, 200)
    return () => clearTimeout(t)
  }, [fetchClients])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Clients</h1>
        <button onClick={() => setShowAddModal(true)} className="btn-primary">
          + Add Client
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="search"
          placeholder="Search by name, phone, or pet…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input max-w-xs"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600"
          />
          Show archived
        </label>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</div>
        ) : clients.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">No clients found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pet</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Last Visit</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Lifetime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-900">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/clients/${client.id}`}
                        className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
                      >
                        {client.first_name} {client.last_name}
                        {client.is_archived && (
                          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">(archived)</span>
                        )}
                      </Link>
                      {client.email && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{client.email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-900 dark:text-gray-100">{client.pet_name}</p>
                      {client.pet_breed && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{client.pet_breed}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{client.phone}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {client.last_appointment_at
                        ? formatDateInBusinessTz(client.last_appointment_at)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrency(client.lifetime_revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <ClientFormModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false)
            fetchClients()
          }}
        />
      )}
    </div>
  )
}
