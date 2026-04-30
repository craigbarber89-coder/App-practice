import sgMail from '@sendgrid/mail'

let _initialised = false

function init() {
  if (!_initialised) {
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SendGrid API key not configured')
    }
    sgMail.setApiKey(process.env.SENDGRID_API_KEY)
    _initialised = true
  }
}

export interface SendEmailResult {
  success: boolean
  providerId?: string
  error?: string
}

export async function sendEmail(
  to: string,
  subject: string,
  textBody: string,
  htmlBody?: string
): Promise<SendEmailResult> {
  try {
    init()
    const [response] = await sgMail.send({
      to,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL!,
        name: process.env.SENDGRID_FROM_NAME ?? process.env.NEXT_PUBLIC_BUSINESS_NAME ?? 'Groomer',
      },
      subject,
      text: textBody,
      html: htmlBody ?? textToHtml(textBody),
    })
    const messageId = response.headers['x-message-id'] as string | undefined
    return { success: true, providerId: messageId }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return { success: false, error }
  }
}

function textToHtml(text: string): string {
  return text
    .split('\n')
    .map((line) => `<p>${line}</p>`)
    .join('')
}
