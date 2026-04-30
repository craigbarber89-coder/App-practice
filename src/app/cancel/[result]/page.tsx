import Link from 'next/link'
import { businessConfig } from '@config'

const MESSAGES: Record<string, { icon: string; title: string; body: string }> = {
  success: {
    icon: '✅',
    title: 'Appointment Cancelled',
    body: "Your appointment has been cancelled. We hope to see you again soon!",
  },
  'already-cancelled': {
    icon: 'ℹ️',
    title: 'Already Cancelled',
    body: "This appointment was already cancelled.",
  },
  'too-late': {
    icon: '⏰',
    title: 'Too Late to Cancel',
    body: `Sorry, cancellations must be made at least ${businessConfig.booking.cancellationCutoffHours} hours before the appointment. Please call us directly.`,
  },
  invalid: {
    icon: '❓',
    title: 'Invalid Link',
    body: "This cancellation link is invalid or expired.",
  },
}

export default function CancelResultPage({ params }: { params: { result: string } }) {
  const msg = MESSAGES[params.result] ?? MESSAGES.invalid

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="text-center max-w-sm">
        <p className="text-5xl mb-4">{msg.icon}</p>
        <h1 className="text-2xl font-bold text-gray-900">{msg.title}</h1>
        <p className="text-gray-600 mt-3 text-sm">{msg.body}</p>
        <Link href="/book" className="inline-block mt-6 btn-primary">
          Book a new appointment
        </Link>
        <p className="mt-4 text-sm text-gray-500">
          {businessConfig.phone}
        </p>
      </div>
    </div>
  )
}
