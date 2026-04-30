'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatInBusinessTz } from '@/lib/utils'
import type { ScheduledMessage } from '@/types'

export default function MessagesPage() {
  const [messages, setMessages] = useState<ScheduledMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [processResult, setProcessResult] = useState<{ processed?: number; failed?: number; error?: string } | null>(null)

  const fetchMessages = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/messages')
    const data = await res.json().catch(() => [])
    setMessages(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchMessages() }, [fetchMessages])

  const failed  = messages.filter((m) => m.status === 'failed')
  const pending = messages.filter((m) => m.status === 'pending')

  async function handleProcessNow() {
    setProcessing(true)
    setProcessResult(null)
    const res = await fetch('/api/messages/process', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setProcessResult(data)
    setProcessing(false)
    await fetchMessages()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Message Log</h1>
        <button
          onClick={handleProcessNow}
          disabled={processing || pending.length === 0}
          className="btn-secondary"
          title={pending.length === 0 ? 'No pending messages' : 'Send all pending messages now'}
        >
          {processing ? 'Sending…' : `⚡ Send Pending Now${pending.length > 0 ? ` (${pending.length})` : ''}`}
        </button>
      </div>

      {/* How it works */}
      <div className="card bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800">
        <h2 className="text-sm font-semibold text-brand-800 dark:text-brand-300 mb-2">How automated messages work</h2>
        <ul className="text-xs text-brand-700 dark:text-brand-400 space-y-1 list-disc list-inside">
          <li>Mark an appointment <strong>Complete</strong> → thank-you SMS/email sent immediately</li>
          <li>24 hours later → feedback request sent (thumbs up / thumbs down link)</li>
          <li>Thumbs up → review request + referral link sent 2 hours later</li>
          <li>Thumbs down → you get a private alert so you can reach out personally</li>
          <li>6 weeks after last visit with no new booking → rebooking reminder sent</li>
          <li>Manual messages can be sent from any <strong>client profile page</strong></li>
        </ul>
        <p className="text-xs text-brand-600 dark:text-brand-500 mt-2">
          In production on Vercel, messages send automatically every minute. Locally, use <strong>Send Pending Now</strong> above to trigger sends manually.
        </p>
      </div>

      {processResult && (
        <div className={`rounded-xl px-4 py-3 text-sm ${
          processResult.error
            ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
            : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
        }`}>
          {processResult.error
            ? `Error: ${processResult.error}`
            : `✓ Sent ${processResult.processed ?? 0} message${processResult.processed !== 1 ? 's' : ''}${processResult.failed ? `, ${processResult.failed} failed` : ''}`}
        </div>
      )}

      {failed.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-red-800 dark:text-red-400 mb-2">
            ⚠️ {failed.length} Failed Message{failed.length !== 1 ? 's' : ''}
          </h2>
          <p className="text-xs text-red-700 dark:text-red-300">
            These messages could not be sent after 3 attempts. Check your Twilio/SendGrid credentials in Settings.
          </p>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</div>
        ) : messages.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No messages yet. Mark an appointment complete or send a message from a client profile to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Scheduled</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">To</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Channel</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sent At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-900">
                {messages.map((msg) => (
                  <tr key={msg.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatInBusinessTz(msg.send_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {msg.recipient_name ?? '—'}
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {msg.recipient_phone ?? msg.recipient_email ?? ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">
                      {msg.message_type.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        msg.channel === 'sms'
                          ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                          : 'bg-sky-50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                      }`}>
                        {msg.channel.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        msg.status === 'sent'
                          ? 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                          : msg.status === 'failed'
                          ? 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                          : msg.status === 'pending'
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {msg.status}
                      </span>
                      {msg.error_message && (
                        <p className="text-xs text-red-500 dark:text-red-400 mt-0.5 max-w-xs truncate">{msg.error_message}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {msg.sent_at ? formatInBusinessTz(msg.sent_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
