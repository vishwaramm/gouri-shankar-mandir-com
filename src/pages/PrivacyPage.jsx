import LegalPage from './LegalPage.jsx'

function PrivacyPage() {
  return (
    <LegalPage
      kicker="Legal"
      title="Privacy Policy"
      intro="How we collect, use, and protect information shared through the site."
      sections={[
        {
          title: 'What we collect',
          paragraphs: [
            'We collect information you choose to submit, such as your name, email address, phone number, message content, account details, service requests, event signups, and temple letters preferences.',
            'We also collect basic technical data such as IP address, browser information, and request timestamps for security, fraud prevention, rate limiting, and service operation.',
          ],
        },
        {
          title: 'How we use it',
          paragraphs: [
            'We use personal information to respond to messages, manage accounts, send temple letters and service updates, process requests, and keep the site secure.',
            'We may also use information to improve the site, troubleshoot issues, maintain records, and comply with legal or accounting obligations.',
          ],
        },
        {
          title: 'How we share it',
          paragraphs: [
            'We do not sell personal information.',
            'Information may be shared with temple officers, email providers, payment processors, hosting providers, and other service vendors only as needed to operate the site and complete your request.',
          ],
        },
        {
          title: 'Storage and retention',
          paragraphs: [
            'Information is stored on our servers and in connected service systems as needed for temple operations.',
            'We retain records for as long as needed for the service, legal, tax, security, and operational purposes, then remove or archive them when appropriate.',
          ],
        },
        {
          title: 'Your choices',
          paragraphs: [
            'You can contact us to update account information, change email preferences, or request that we review data related to your account or message.',
            'If you unsubscribe from temple letters, we stop sending those messages, subject to any required service or transactional notices.',
          ],
        },
      ]}
    />
  )
}

export default PrivacyPage
