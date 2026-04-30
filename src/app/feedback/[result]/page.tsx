import { businessConfig } from '@config'

export default function FeedbackResultPage({ params }: { params: { result: string } }) {
  const isPositive = params.result === 'positive'
  const isNegative = params.result === 'negative'

  if (!isPositive && !isNegative) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
        <div className="text-center">
          <p className="text-2xl mb-2">🤔</p>
          <h1 className="text-xl font-semibold text-gray-900">Invalid feedback link</h1>
          <p className="text-sm text-gray-500 mt-2">This link doesn&apos;t look right.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-brand-50 to-white">
      <div className="text-center max-w-sm">
        <p className="text-5xl mb-4">{isPositive ? '🎉' : '💙'}</p>
        <h1 className="text-2xl font-bold text-gray-900">
          {isPositive ? 'Thanks for the feedback!' : 'Thank you for letting us know.'}
        </h1>
        <p className="text-gray-600 mt-3 text-sm">
          {isPositive
            ? `We're so glad you had a great experience! Keep an eye out for a text from us shortly.`
            : `We're sorry to hear that. ${businessConfig.name} will be in touch with you personally to make things right.`}
        </p>
        <p className="mt-6 text-sm text-brand-600 font-medium">{businessConfig.name}</p>
      </div>
    </div>
  )
}
