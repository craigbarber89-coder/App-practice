import twilio from 'twilio'

let _client: ReturnType<typeof twilio> | null = null

function getClient() {
  if (!_client) {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials not configured')
    }
    _client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  }
  return _client
}

export interface SendSmsResult {
  success: boolean
  providerId?: string
  error?: string
}

export async function sendSms(to: string, body: string): Promise<SendSmsResult> {
  try {
    const client = getClient()
    const message = await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to,
    })
    return { success: true, providerId: message.sid }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return { success: false, error }
  }
}

/** Normalise a phone number to E.164. Returns null if unparseable. */
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (digits.length > 7) return `+${digits}`
  return null
}
