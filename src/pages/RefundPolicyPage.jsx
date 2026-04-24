import LegalPage from './LegalPage.jsx'

function RefundPolicyPage() {
  return (
    <LegalPage
      kicker="Legal"
      title="Refund & Cancellation Policy"
      intro="Refunds and cancellations are handled rarely and only under limited circumstances."
      sections={[
        {
          title: 'Strict rule',
          paragraphs: [
            'Payments for services, offerings, and administrative processing are generally final.',
            'Refunds are not routine and should not be expected once a request has been accepted or work has begun.',
          ],
        },
        {
          title: 'Rare exceptions',
          paragraphs: [
            'A refund or cancellation may be considered only in rare circumstances such as a clear duplicate payment, a technical billing error, or another issue we confirm in writing.',
            'Any exception is reviewed case by case and is never guaranteed.',
          ],
        },
        {
          title: 'Timing and work already started',
          paragraphs: [
            'Once preparation, priest scheduling, event planning, or ritual work has started, cancellation and refund rights are extremely limited.',
            'If a service has already been performed, completed, or materially prepared, no refund is normally available.',
          ],
        },
        {
          title: 'How to request review',
          paragraphs: [
            'If you believe an exception applies, contact the temple as soon as possible with your order code and the reason for review.',
            'Do not assume a request will be approved until we confirm it in writing.',
          ],
        },
        {
          title: 'Final decision',
          paragraphs: [
            'The temple’s written decision is final for the purposes of the site process.',
            'If a chargeback is filed for a service that was already delivered or prepared, we may respond with the service record and any supporting information.',
          ],
        },
      ]}
    />
  )
}

export default RefundPolicyPage
