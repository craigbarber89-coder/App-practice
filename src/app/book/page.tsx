'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { businessConfig } from '@config'
import type { Service } from '@/types'
import { formatCurrency } from '@/lib/utils'
import ThemeToggle from '@/components/ui/ThemeToggle'

type Step = 'phone' | 'details' | 'service' | 'time' | 'confirm' | 'done'

interface ExistingClient {
  id: string
  first_name: string
  last_name: string
  email: string | null
  pet_name: string
  pet_breed: string | null
}

// Inner component that uses useSearchParams (must be inside Suspense)
function BookingContent() {
  const searchParams = useSearchParams()
  const refCode = searchParams.get('ref') ?? ''

  const [step, setStep] = useState<Step>('phone')
  const [services, setServices] = useState<Service[]>([])
  const [existingClient, setExistingClient] = useState<ExistingClient | null>(null)

  const [phone, setPhone] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [petName, setPetName] = useState('')
  const [petBreed, setPetBreed] = useState('')
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedSlot, setSelectedSlot] = useState('')
  const [availableSlots, setAvailableSlots] = useState<string[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [bookingResult, setBookingResult] = useState<{ appointment: { id: string; scheduled_at: string } } | null>(null)

  useEffect(() => {
    fetch('/api/services')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Service[]) => Array.isArray(data) && setServices(data.filter((s) => s.is_active)))
      .catch(() => {})
  }, [])

  // Generate available slots for selected service (next N days, business hours)
  useEffect(() => {
    if (!selectedService) return
    const slots: string[] = []
    const now = new Date()
    for (let d = 1; d <= businessConfig.booking.bookingWindowDays; d++) {
      const date = new Date(now)
      date.setDate(date.getDate() + d)
      const day = date.getDay() // 0 = Sunday
      if (day === 0) continue // skip Sunday
      const closeHour = day === 6 ? 14 : 17 // Sat closes at 14:00
      for (let h = 9; h < closeHour; h++) {
        const slot = new Date(date)
        slot.setHours(h, 0, 0, 0)
        slots.push(slot.toISOString())
      }
    }
    setAvailableSlots(slots.slice(0, 30))
  }, [selectedService])

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch(`/api/book?phone=${encodeURIComponent(phone)}`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Could not look up your number. Please try again.')
      setLoading(false)
      return
    }
    const data = await res.json()

    if (data.client) {
      const c: ExistingClient = data.client
      setExistingClient(c)
      setFirstName(c.first_name)
      setLastName(c.last_name)
      setEmail(c.email ?? '')
      setPetName(c.pet_name)
      setPetBreed(c.pet_breed ?? '')
      setStep('service')
    } else {
      setStep('details')
    }
    setLoading(false)
  }

  async function handleBook() {
    setLoading(true)
    setError('')

    const payload = {
      phone,
      first_name: firstName || undefined,
      last_name: lastName || undefined,
      email: email || undefined,
      pet_name: petName || undefined,
      pet_breed: petBreed || undefined,
      service_id: selectedService!.id,
      scheduled_at: selectedSlot,
      referred_by_code: refCode || undefined,
    }

    const res = await fetch('/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({ error: 'Unexpected server response — please try again.' }))

    if (res.ok) {
      setBookingResult(data)
      setStep('done')
    } else {
      setError(data.error ?? 'Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  return (
    <>
      {step === 'done' ? (
        <div className="card text-center space-y-4">
          <div className="text-5xl">🐾</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Booking Request Sent!</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            We&apos;ve received your request and will confirm shortly via text message.
          </p>
          {bookingResult && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Requested time:{' '}
              <strong>
                {new Date(bookingResult.appointment.scheduled_at).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </strong>
            </p>
          )}
        </div>
      ) : (
        <div className="card space-y-6">
          <ProgressBar step={step} />

          {/* Step: Phone */}
          {step === 'phone' && (
            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold dark:text-gray-100">Let&apos;s get started</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Enter your phone number to book or rebook.</p>
              </div>
              <div>
                <label className="label">Phone Number</label>
                <input
                  className="input"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Looking up…' : 'Continue'}
              </button>
              <p className="text-center text-xs text-gray-400 dark:text-gray-500 pt-1">
                New here?{' '}
                <a href="/apply" className="text-brand-600 dark:text-brand-400 hover:underline">
                  Request a client account
                </a>
              </p>
            </form>
          )}

          {/* Step: Details (new client) */}
          {step === 'details' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold dark:text-gray-100">Tell us about yourself</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">First time here? We just need a few details.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">First Name *</label>
                  <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </div>
                <div>
                  <label className="label">Last Name *</label>
                  <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="optional, for confirmation" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Pet&apos;s Name *</label>
                  <input className="input" value={petName} onChange={(e) => setPetName(e.target.value)} required />
                </div>
                <div>
                  <label className="label">Breed</label>
                  <input className="input" value={petBreed} onChange={(e) => setPetBreed(e.target.value)} placeholder="optional" />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep('phone')} className="btn-secondary flex-1">Back</button>
                <button
                  disabled={!firstName || !lastName || !petName}
                  onClick={() => setStep('service')}
                  className="btn-primary flex-1"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step: Service */}
          {step === 'service' && (
            <div className="space-y-4">
              {existingClient && (
                <div className="bg-brand-50 dark:bg-brand-900/30 rounded-lg px-4 py-3 text-sm dark:text-gray-200">
                  Welcome back, <strong>{existingClient.first_name}</strong>! Booking for <strong>{existingClient.pet_name}</strong>.
                </div>
              )}
              <h2 className="text-lg font-semibold dark:text-gray-100">Choose a service</h2>
              <div className="space-y-2">
                {services.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Loading services…</p>
                )}
                {services.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => { setSelectedService(service); setStep('time') }}
                    className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-colors ${
                      selectedService?.id === service.id
                        ? 'border-brand-600 bg-brand-50 dark:border-brand-500 dark:bg-brand-900/30'
                        : 'border-gray-200 hover:border-brand-300 dark:border-gray-700 dark:hover:border-brand-500 dark:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{service.name}</p>
                        {service.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{service.description}</p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{service.duration_minutes} min</p>
                      </div>
                      <span className="font-bold text-gray-900 dark:text-gray-100">{formatCurrency(service.price)}</span>
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(existingClient ? 'phone' : 'details')} className="btn-secondary w-full">
                Back
              </button>
            </div>
          )}

          {/* Step: Time */}
          {step === 'time' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold dark:text-gray-100">Pick a time</h2>
              <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
                {availableSlots.map((slot) => {
                  const d = new Date(slot)
                  const label =
                    d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
                    ' ' +
                    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                  return (
                    <button
                      key={slot}
                      onClick={() => { setSelectedSlot(slot); setStep('confirm') }}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs text-left text-gray-800 dark:text-gray-200 hover:border-brand-500 hover:bg-brand-50 dark:hover:border-brand-400 dark:hover:bg-brand-900/30 transition-colors"
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              <button onClick={() => setStep('service')} className="btn-secondary w-full">Back</button>
            </div>
          )}

          {/* Step: Confirm */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold dark:text-gray-100">Confirm your booking</h2>
              <dl className="space-y-2 text-sm divide-y divide-gray-100 dark:divide-gray-700">
                <div className="flex justify-between py-1.5"><dt className="text-gray-500 dark:text-gray-400">Name</dt><dd className="font-medium dark:text-gray-100">{firstName} {lastName}</dd></div>
                <div className="flex justify-between py-1.5"><dt className="text-gray-500 dark:text-gray-400">Pet</dt><dd className="font-medium dark:text-gray-100">{petName}</dd></div>
                <div className="flex justify-between py-1.5"><dt className="text-gray-500 dark:text-gray-400">Service</dt><dd className="font-medium dark:text-gray-100">{selectedService?.name}</dd></div>
                <div className="flex justify-between py-1.5"><dt className="text-gray-500 dark:text-gray-400">Price</dt><dd className="font-bold dark:text-gray-100">{formatCurrency(selectedService?.price ?? 0)}</dd></div>
                <div className="flex justify-between py-1.5">
                  <dt className="text-gray-500 dark:text-gray-400">Date &amp; Time</dt>
                  <dd className="font-medium text-right dark:text-gray-100">
                    {new Date(selectedSlot).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    <br />
                    {new Date(selectedSlot).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </dd>
                </div>
              </dl>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                You can cancel up to {businessConfig.booking.cancellationCutoffHours} hours before your appointment via the link we send you.
              </p>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setStep('time')} className="btn-secondary flex-1">Back</button>
                <button onClick={handleBook} disabled={loading} className="btn-primary flex-1">
                  {loading ? 'Booking…' : 'Request Appointment'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

export default function BookingPage() {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-brand-50 to-white dark:from-gray-950 dark:to-gray-900 px-4 py-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-700 dark:text-brand-500">{businessConfig.name}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{businessConfig.tagline}</p>
        </div>

        {/* Suspense boundary required for useSearchParams in App Router */}
        <Suspense fallback={
          <div className="card flex items-center justify-center min-h-[200px]">
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
          </div>
        }>
          <BookingContent />
        </Suspense>
      </div>
    </div>
  )
}

function ProgressBar({ step }: { step: Step }) {
  const steps: Step[] = ['phone', 'details', 'service', 'time', 'confirm']
  const current = steps.indexOf(step)
  if (current === -1) return null
  return (
    <div className="flex gap-1">
      {steps.map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors ${
            i <= current ? 'bg-brand-500' : 'bg-gray-200 dark:bg-gray-700'
          }`}
        />
      ))}
    </div>
  )
}
