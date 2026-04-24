import LegalPage from './LegalPage.jsx'

function EmailConsentPage() {
  return (
    <LegalPage
      kicker="Legal"
      title="Email Consent"
      intro="How temple letters and service emails are sent and how to opt out."
      sections={[
        {
          title: 'Temple letters',
          paragraphs: [
            'When you sign up for temple letters, you consent to receive devotional announcements, festival notes, and other temple communication at the email address you provide.',
            'You may unsubscribe from temple letters at any time through the unsubscribe page or by contacting us.',
          ],
        },
        {
          title: 'Service emails',
          paragraphs: [
            'If you request a service, account update, or support action, we may send transactional emails related to that request.',
            'Transactional messages are part of the service and may still be sent even if marketing-style temple letters are turned off.',
          ],
        },
        {
          title: 'Sender and replies',
          paragraphs: [
            'Temple emails are sent from the temple’s no-reply or support email accounts, depending on the message type.',
            'If you reply to a temple email, your response may be routed to the relevant officers for follow-up.',
          ],
        },
      ]}
    />
  )
}

export default EmailConsentPage
