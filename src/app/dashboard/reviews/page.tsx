import { createServiceClient } from '@/lib/supabase/server'
import { formatInBusinessTz } from '@/lib/utils'
import Link from 'next/link'

export default async function ReviewsPage() {
  const supabase = createServiceClient()

  const [
    { data: feedback },
    { data: referrals },
    { data: reviewClicks },
  ] = await Promise.all([
    supabase
      .from('feedback_responses')
      .select('*, client:clients(first_name, last_name, pet_name), appointment:appointments(scheduled_at)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('referrals')
      .select('*, referrer:clients!referrer_client_id(first_name, last_name), referred:clients!referred_client_id(first_name, last_name, created_at)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('review_link_clicks')
      .select('*, client:clients(first_name, last_name)')
      .order('clicked_at', { ascending: false })
      .limit(50),
  ])

  const positiveCount = (feedback ?? []).filter((f) => f.sentiment === 'positive').length
  const negativeCount = (feedback ?? []).filter((f) => f.sentiment === 'negative').length

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reviews & Referrals</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Positive Feedback</p>
          <p className="mt-2 text-2xl font-bold text-green-700 dark:text-green-400">{positiveCount}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Negative Feedback</p>
          <p className="mt-2 text-2xl font-bold text-red-700 dark:text-red-400">{negativeCount}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Review Link Clicks</p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{reviewClicks?.length ?? 0}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Referrals</p>
          <p className="mt-2 text-2xl font-bold text-brand-600 dark:text-brand-400">{referrals?.length ?? 0}</p>
        </div>
      </div>

      {/* Feedback table */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Feedback Responses</h2>
        {(feedback ?? []).length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No feedback yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Appointment</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Response</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Responded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(feedback ?? []).map((f) => (
                  <tr key={f.id}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <Link href={`/dashboard/clients/${f.client_id}`} className="text-brand-600 hover:underline">
                        {(f.client as { first_name: string; last_name: string } | null)?.first_name}{' '}
                        {(f.client as { first_name: string; last_name: string } | null)?.last_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {(f.appointment as { scheduled_at: string } | null)?.scheduled_at
                        ? formatInBusinessTz((f.appointment as { scheduled_at: string }).scheduled_at, 'MMM d, yyyy')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {f.responded_at ? (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          f.sentiment === 'positive' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {f.sentiment === 'positive' ? '👍 Positive' : '👎 Negative'}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">No response yet</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {f.responded_at ? formatInBusinessTz(f.responded_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Referrals */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Referrals</h2>
        {(referrals ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">No referrals yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {(referrals ?? []).map((r) => (
              <li key={r.id} className="py-3 flex items-center justify-between text-sm">
                <span>
                  <span className="font-medium">
                    {(r.referrer as { first_name: string; last_name: string } | null)?.first_name}{' '}
                    {(r.referrer as { first_name: string; last_name: string } | null)?.last_name}
                  </span>
                  <span className="text-gray-500"> referred </span>
                  <Link href={`/dashboard/clients/${r.referred_client_id}`} className="text-brand-600 hover:underline font-medium">
                    {(r.referred as { first_name: string; last_name: string } | null)?.first_name}{' '}
                    {(r.referred as { first_name: string; last_name: string } | null)?.last_name}
                  </Link>
                </span>
                <span className="text-xs text-gray-400">
                  {formatInBusinessTz(r.created_at, 'MMM d, yyyy')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
