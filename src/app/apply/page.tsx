'use client'

import { useState } from 'react'
import Link from 'next/link'
import { businessConfig } from '@config'
import ThemeToggle from '@/components/ui/ThemeToggle'

interface Form {
  first_name: string
  last_name: string
  phone: string
  email: string
  pet_name: string
  pet_breed: string
  pet_notes: string
  applicant_message: string
}

const EMPTY: Form = {
  first_name: '', last_name: '', phone: '', email: '',
  pet_name: '', pet_breed: '', pet_notes: '', applicant_message: '',
}

export default function ApplyPage() {
  const [form, setForm] = useState<Form>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const set = (field: keyof Form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await res.json().catch(() => ({ error: 'Unexpected error. Please try again.' }))

    if (res.ok) {
      setDone(true)
    } else {
      setError(data.error ?? 'Something went wrong. Please try again.')
    }

    setSubmitting(false)
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-brand-50 to-white dark:from-gray-950 dark:to-gray-900 px-4 py-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-700 dark:text-brand-500">{businessConfig.name}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{businessConfig.tagline}</p>
        </div>

        {done ? (
          /* Success state */
          <div className="card text-center space-y-4">
            <div className="text-5xl">🐾</div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Application Submitted!</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Thanks, <strong>{form.first_name}</strong>! We&apos;ve received your application and will review it shortly.
              We&apos;ll be in touch via phone or email once it&apos;s been approved.
            </p>
            <Link href="/book" className="inline-block text-sm text-brand-600 dark:text-brand-400 hover:underline mt-2">
              ← Back to booking page
            </Link>
          </div>
        ) : (
          <div className="card space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Request a Client Account</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Fill in your details below and we&apos;ll review your application. Once approved, you&apos;ll be able to book appointments online.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">First Name *</label>
                  <input
                    className="input"
                    value={form.first_name}
                    onChange={set('first_name')}
                    placeholder="Jane"
                    required
                  />
                </div>
                <div>
                  <label className="label">Last Name *</label>
                  <input
                    className="input"
                    value={form.last_name}
                    onChange={set('last_name')}
                    placeholder="Smith"
                    required
                  />
                </div>
              </div>

              {/* Contact */}
              <div>
                <label className="label">Phone Number *</label>
                <input
                  className="input"
                  type="tel"
                  value={form.phone}
                  onChange={set('phone')}
                  placeholder="(555) 000-0000"
                  required
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  We&apos;ll use this to confirm appointments via text.
                </p>
              </div>

              <div>
                <label className="label">Email</label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="jane@example.com (optional)"
                />
              </div>

              {/* Pet info */}
              <div className="pt-1">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Pet Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Pet&apos;s Name *</label>
                    <input
                      className="input"
                      value={form.pet_name}
                      onChange={set('pet_name')}
                      placeholder="Buddy"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Breed</label>
                    <input
                      className="input"
                      value={form.pet_breed}
                      onChange={set('pet_breed')}
                      placeholder="e.g. Golden Retriever"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Pet Notes</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  value={form.pet_notes}
                  onChange={set('pet_notes')}
                  placeholder="Any health conditions, anxiety, special needs, or things we should know about your pet…"
                />
              </div>

              {/* Message */}
              <div>
                <label className="label">
                  Anything else you&apos;d like to tell us?{' '}
                  <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
                </label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  value={form.applicant_message}
                  onChange={set('applicant_message')}
                  placeholder="How did you hear about us? Any questions or special requests?"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full"
              >
                {submitting ? 'Submitting…' : 'Submit Application'}
              </button>

              <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                Already a client?{' '}
                <Link href="/book" className="text-brand-600 dark:text-brand-400 hover:underline">
                  Book directly here
                </Link>
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
