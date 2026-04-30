/**
 * Business configuration — all business-specific content lives here.
 * For production deployments, values are overridden via environment variables
 * so the same codebase can serve different grooming businesses.
 */

export const businessConfig = {
  name: process.env.NEXT_PUBLIC_BUSINESS_NAME ?? 'Pawfect Grooming',
  tagline: process.env.NEXT_PUBLIC_BUSINESS_TAGLINE ?? 'Professional pet grooming you can trust',
  phone: process.env.NEXT_PUBLIC_BUSINESS_PHONE ?? '+15550000000',
  email: process.env.NEXT_PUBLIC_BUSINESS_EMAIL ?? 'hello@pawfectgrooming.com',
  address: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS ?? '123 Main St, Anytown, USA',
  timezone: process.env.NEXT_PUBLIC_BUSINESS_TIMEZONE ?? 'America/New_York',

  /** Google review link — configured in Settings panel */
  googleReviewUrl: process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL ?? '',

  /** Brand colors — override to match the business */
  colors: {
    primary: process.env.NEXT_PUBLIC_COLOR_PRIMARY ?? '#7c3aed',
    primaryDark: process.env.NEXT_PUBLIC_COLOR_PRIMARY_DARK ?? '#5b21b6',
    primaryLight: process.env.NEXT_PUBLIC_COLOR_PRIMARY_LIGHT ?? '#ede9fe',
  },

  /** Booking portal settings */
  booking: {
    /** Minimum hours before appointment that client can cancel */
    cancellationCutoffHours: 24,
    /** How far ahead (in days) clients can book */
    bookingWindowDays: 60,
    /** Appointment slot duration in minutes */
    defaultSlotMinutes: 60,
  },

  /** Automated messaging delays */
  messaging: {
    /** Hours after completion to send feedback request */
    feedbackDelayHours: 24,
    /** Hours after thumbs-up to send review request */
    reviewDelayHours: 2,
    /** Weeks after last appointment to send rebooking reminder */
    rebookingReminderWeeks: 6,
  },
}

export type BusinessConfig = typeof businessConfig
