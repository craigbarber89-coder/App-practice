'use client'

import { useState } from 'react'
import type { Client } from '@/types'

interface Props {
  client: Client
}

const QUICK_MESSAGES = [
  {
    key: 'rebooking_reminder',
    label: "Rebooking Reminder",
    description: "Remind the client it's time to book their next appointment.",
    icon: '📅',
  },
  {
    key: 'review_request',
    label: 'Review Request',
    description: 'Ask the client to leave a Google review and share their referral link.',
    icon: '⭐',
  },
  {
    key: 'completion_thankyou',
    label: 'Thank-You',
    description: 'Send a thank-you message after a visit.',
    icon: '🐾',
  },
  {
    key: 'custom',
    label: 'Custom Message',
    description: 'Write your own message to this client.',
    icon: '✏️',
  },
] as const

type MessageKey = typeof QUICK_MESSAGES[number]['key']

export default function SendMessagePanel({ client }: Props) {
  const [selectedType, setSelectedType] = useState<MessageKey | null>(null)
  const [channel, setChannel] = useState<'sms' | 'email' | 'both'>('sms')
  const [customBody, setCustomBody] = useState('')
  const [customSubject, setCustomSubject] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok?: boolean; error?: string; queued?: string[]; warning?: string } | null>(null)

  const hasEmail = !!client.email

  async function handleSend() {
    if (!selectedType) return
    setSending(true)
    setResult(null)

    const res = await fetch('/api/messages/send-manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: client.id,
        message_type: selectedType,
        channel,
        custom_body: selectedType === 'custom' ? customBody : undefined,
        custom_subject: selectedType === 'custom' ? customSubject : undefined,
      }),
    })

    const data = await res.json().catch(() => ({ error: 'Unexpected error' }))
    setResult(data)
    setSending(false)

    if (data.ok) {
      setTimeout(() => {
        setResult(null)
        setSelectedType(null)
        setCustomBody('')
        setCustomSubject('')
      }, 4000)
    }
  }

  return (
    <div className="card space-y-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Send Message</h2>

      {/* Message type picker */}
      <div className="grid grid-cols-2 gap-2">
        {QUICK_MESSAGES.map((msg) => (
          <button
            key={msg.key}
            onClick={() => setSelectedType(msg.key)}
            className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
              selectedType === msg.key
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 dark:border-brand-400'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <p className="text-base mb-0.5">{msg.icon}</p>
            <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{msg.label}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight mt-0.5">{msg.description}</p>
          </button>
        ))}
      </div>

      {/* Custom message body */}
      {selectedType === 'custom' && (
        <div className="space-y-2">
          <div>
            <label className="label">Subject <span className="text-gray-400 dark:text-gray-500">(email only)</span></label>
            <input
              className="input"
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              placeholder="e.g. Quick note from Pawfect Grooming"
            />
          </div>
          <div>
            <label className="label">Message</label>
            <textarea
              className="input resize-none"
              rows={4}
              value={customBody}
              onChange={(e) => setCustomBody(e.target.value)}
              placeholder={`Hi ${client.first_name}, …`}
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Available: {'{{client_first_name}}'}, {'{{pet_name}}'}, {'{{business_name}}'}, {'{{booking_url}}'}
            </p>
          </div>
        </div>
      )}

      {/* Channel selector */}
      {selectedType && (
        <div>
          <label className="label">Send via</label>
          <div className="flex gap-2">
            {(['sms', 'email', 'both'] as const).map((ch) => {
              const disabled = (ch === 'email' || ch === 'both') && !hasEmail
              return (
                <button
                  key={ch}
                  disabled={disabled}
                  onClick={() => setChannel(ch)}
                  title={disabled ? 'Client has no email address' : ''}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    channel === ch && !disabled
                      ? 'bg-brand-600 text-white border-brand-600 dark:bg-brand-500 dark:border-brand-500'
                      : disabled
                      ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600 dark:border-gray-700'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                  }`}
                >
                  {ch === 'sms' ? '💬 SMS' : ch === 'email' ? '📧 Email' : '📨 Both'}
                </button>
              )
            })}
          </div>
          {!hasEmail && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">No email on file — SMS only available.</p>
          )}
        </div>
      )}

      {/* Result */}
      {result?.ok && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          ✓ {result.queued?.join(' + ')} queued successfully. It will send within a minute.
        </div>
      )}
      {result?.warning && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          ⚠️ {result.warning}
        </div>
      )}
      {result?.error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {result.error}
        </div>
      )}

      {/* Send button */}
      {selectedType && (
        <button
          onClick={handleSend}
          disabled={sending || (selectedType === 'custom' && !customBody.trim())}
          className="btn-primary w-full"
        >
          {sending ? 'Queuing…' : `Send ${selectedType === 'custom' ? 'Custom Message' : QUICK_MESSAGES.find(m => m.key === selectedType)?.label}`}
        </button>
      )}
    </div>
  )
}
