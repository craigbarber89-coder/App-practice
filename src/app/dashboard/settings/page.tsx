'use client'

import { useEffect, useState } from 'react'

const SETTING_GROUPS = [
  {
    title: 'Business',
    keys: [
      { key: 'google_review_url', label: 'Google Review URL', placeholder: 'https://g.page/r/...' },
      { key: 'tax_rate_percent', label: 'Tax Rate % (for revenue estimates)', placeholder: 'e.g. 25' },
    ],
  },
  {
    title: 'Business Hours',
    keys: [
      { key: 'business_hours_json', label: 'Business Hours (JSON)', multiline: true },
    ],
  },
  {
    title: 'SMS Templates',
    keys: [
      { key: 'sms_template_completion_thankyou', label: 'Thank-You SMS', multiline: true },
      { key: 'sms_template_feedback_request', label: 'Feedback Request SMS', multiline: true },
      { key: 'sms_template_review_request', label: 'Review Request SMS', multiline: true },
      { key: 'sms_template_rebooking_reminder', label: 'Rebooking Reminder SMS', multiline: true },
    ],
  },
  {
    title: 'Email Templates',
    keys: [
      { key: 'email_template_booking_confirmation_subject', label: 'Booking Confirmation Subject' },
      { key: 'email_template_booking_confirmation_body', label: 'Booking Confirmation Body', multiline: true },
    ],
  },
]

const PLACEHOLDERS_HELP = `Available placeholders: {{client_first_name}}, {{pet_name}}, {{business_name}}, {{feedback_url}}, {{review_url}}, {{referral_url}}, {{booking_url}}, {{appointment_date}}, {{appointment_time}}, {{cancel_url}}`

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then(setSettings)
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)

    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>

      <p className="text-sm text-gray-500 dark:text-gray-400">{PLACEHOLDERS_HELP}</p>

      <form onSubmit={handleSave} className="space-y-6">
        {SETTING_GROUPS.map((group) => (
          <div key={group.title} className="card space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 pb-2">
              {group.title}
            </h2>
            {group.keys.map(({ key, label, placeholder, multiline }) => (
              <div key={key}>
                <label className="label">{label}</label>
                {multiline ? (
                  <textarea
                    className="input resize-none font-mono text-xs"
                    rows={4}
                    value={settings[key] ?? ''}
                    onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value }))}
                  />
                ) : (
                  <input
                    className="input"
                    value={settings[key] ?? ''}
                    onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value }))}
                    placeholder={placeholder}
                  />
                )}
              </div>
            ))}
          </div>
        ))}

        <div className="flex items-center gap-4">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
          {saved && <span className="text-sm text-green-600 dark:text-green-400 font-medium">Saved!</span>}
        </div>
      </form>
    </div>
  )
}
