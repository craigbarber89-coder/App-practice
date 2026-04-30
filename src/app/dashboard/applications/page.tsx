'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { formatInBusinessTz } from '@/lib/utils'

interface Application {
  id: string
  first_name: string
  last_name: string
  phone: string
  email: string | null
  pet_name: string
  pet_breed: string | null
  pet_notes: string | null
  applicant_message: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  reviewed_at: string | null
  client_id: string | null
  created_at: string
}

type FilterStatus = 'pending' | 'approved' | 'rejected' | 'all'

const TABS: { key: FilterStatus; label: string }[] = [
  { key: 'pending',  label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all',      label: 'All' },
]

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterStatus>('pending')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [actionState, setActionState] = useState<Record<string, 'approving' | 'rejecting' | null>>({})
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})
  const [showNotesFor, setShowNotesFor] = useState<string | null>(null)

  const fetchApplications = useCallback(async () => {
    setLoading(true)
    const params = filter !== 'all' ? `?status=${filter}` : ''
    const res = await fetch(`/api/applications${params}`)
    const data = await res.json().catch(() => [])
    setApplications(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [filter])

  useEffect(() => { fetchApplications() }, [fetchApplications])

  const pendingCount = applications.filter((a) => a.status === 'pending').length

  async function handleAction(id: string, action: 'approve' | 'reject') {
    setActionState((s) => ({ ...s, [id]: action === 'approve' ? 'approving' : 'rejecting' }))

    const res = await fetch(`/api/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, admin_notes: adminNotes[id] || undefined }),
    })

    setActionState((s) => ({ ...s, [id]: null }))

    if (res.ok) {
      setShowNotesFor(null)
      await fetchApplications()
    }
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Client Applications</h1>
          {filter === 'pending' && pendingCount > 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-0.5">
              {pendingCount} application{pendingCount !== 1 ? 's' : ''} awaiting review
            </p>
          )}
        </div>
        <a
          href="/apply"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary text-xs"
        >
          ↗ View Application Form
        </a>
      </div>

      {/* Info box */}
      <div className="card bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800">
        <p className="text-xs text-brand-700 dark:text-brand-400">
          New clients can fill out the application form at{' '}
          <span className="font-mono font-medium">/apply</span>. Once you approve an application, a client
          record is automatically created and they can start booking at{' '}
          <span className="font-mono font-medium">/book</span>.
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 flex-wrap">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === key
                ? key === 'pending' ? 'bg-amber-500 text-white'
                : key === 'approved' ? 'bg-green-600 text-white'
                : key === 'rejected' ? 'bg-red-600 text-white'
                : 'bg-brand-600 text-white dark:bg-brand-500'
                : 'bg-white text-gray-600 ring-1 ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Applications list */}
      {loading ? (
        <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</div>
      ) : applications.length === 0 ? (
        <div className="card text-center text-sm text-gray-500 dark:text-gray-400 py-10">
          {filter === 'pending' ? 'No pending applications.' : 'No applications found.'}
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <div key={app.id} className="card p-0 overflow-hidden">
              {/* Header row */}
              <button
                onClick={() => setExpanded(expanded === app.id ? null : app.id)}
                className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {app.first_name} {app.last_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {app.pet_name}{app.pet_breed ? ` (${app.pet_breed})` : ''} · {app.phone}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
                    {formatInBusinessTz(app.created_at, 'MMM d, yyyy')}
                  </span>
                  <StatusBadge status={app.status} />
                  <span className="text-gray-400 dark:text-gray-500 text-xs">
                    {expanded === app.id ? '▲' : '▼'}
                  </span>
                </div>
              </button>

              {/* Expanded detail */}
              {expanded === app.id && (
                <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-4 space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    {/* Contact */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Contact</p>
                      <dl className="space-y-1">
                        <div className="flex gap-2"><dt className="text-gray-500 dark:text-gray-400 w-12">Phone</dt><dd className="font-medium dark:text-gray-100">{app.phone}</dd></div>
                        {app.email && <div className="flex gap-2"><dt className="text-gray-500 dark:text-gray-400 w-12">Email</dt><dd className="font-medium dark:text-gray-100">{app.email}</dd></div>}
                        <div className="flex gap-2"><dt className="text-gray-500 dark:text-gray-400 w-12">Applied</dt><dd className="dark:text-gray-300">{formatInBusinessTz(app.created_at, 'MMM d, yyyy h:mm a')}</dd></div>
                      </dl>
                    </div>

                    {/* Pet */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pet</p>
                      <dl className="space-y-1">
                        <div className="flex gap-2"><dt className="text-gray-500 dark:text-gray-400 w-12">Name</dt><dd className="font-medium dark:text-gray-100">{app.pet_name}</dd></div>
                        {app.pet_breed && <div className="flex gap-2"><dt className="text-gray-500 dark:text-gray-400 w-12">Breed</dt><dd className="dark:text-gray-300">{app.pet_breed}</dd></div>}
                      </dl>
                    </div>
                  </div>

                  {/* Pet notes */}
                  {app.pet_notes && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Pet Notes</p>
                      <p className="text-sm text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 rounded-lg px-3 py-2">
                        {app.pet_notes}
                      </p>
                    </div>
                  )}

                  {/* Applicant message */}
                  {app.applicant_message && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Message from Applicant</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 italic">
                        &ldquo;{app.applicant_message}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* Admin notes (if reviewed) */}
                  {app.admin_notes && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Your Notes</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{app.admin_notes}</p>
                    </div>
                  )}

                  {/* Link to client if approved */}
                  {app.status === 'approved' && app.client_id && (
                    <Link
                      href={`/dashboard/clients/${app.client_id}`}
                      className="inline-block text-sm text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      → View client profile
                    </Link>
                  )}

                  {/* Actions for pending */}
                  {app.status === 'pending' && (
                    <div className="pt-1 space-y-3 border-t border-gray-100 dark:border-gray-700">
                      {/* Optional notes field */}
                      {showNotesFor === app.id ? (
                        <div>
                          <label className="label text-xs">Add a note (optional — saved with this application)</label>
                          <textarea
                            className="input resize-none text-sm"
                            rows={2}
                            value={adminNotes[app.id] ?? ''}
                            onChange={(e) => setAdminNotes((n) => ({ ...n, [app.id]: e.target.value }))}
                            placeholder="Internal note about this application…"
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowNotesFor(app.id)}
                          className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 underline"
                        >
                          + Add note
                        </button>
                      )}

                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => handleAction(app.id, 'approve')}
                          disabled={!!actionState[app.id]}
                          className="btn-primary px-5"
                        >
                          {actionState[app.id] === 'approving' ? 'Approving…' : '✓ Approve'}
                        </button>
                        <button
                          onClick={() => handleAction(app.id, 'reject')}
                          disabled={!!actionState[app.id]}
                          className="btn-danger px-5"
                        >
                          {actionState[app.id] === 'rejecting' ? 'Rejecting…' : '✕ Reject'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: Application['status'] }) {
  const styles = {
    pending:  'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    approved: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    rejected: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  )
}
