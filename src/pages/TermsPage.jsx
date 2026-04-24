import LegalPage from './LegalPage.jsx'

function TermsPage() {
  return (
    <LegalPage
      kicker="Legal"
      title="Terms of Use"
      intro="The rules for using the site, its services, and temple communications."
      sections={[
        {
          title: 'Using the site',
          paragraphs: [
            'By using this site, you agree to provide accurate information and to use the site in a lawful and respectful manner.',
            'Do not interfere with site operation, attempt unauthorized access, or submit content that is harmful, abusive, or misleading.',
          ],
        },
        {
          title: 'Accounts and responsibility',
          paragraphs: [
            'You are responsible for keeping your account credentials private and for activity carried out through your account.',
            'We may suspend or close access if we believe an account is misused, compromised, or used to interfere with temple operations.',
          ],
        },
        {
          title: 'Content and communications',
          paragraphs: [
            'Temple posts, teachings, and announcements are provided for informational and devotional purposes.',
            'Messages you send through the site may be stored for operational, support, and recordkeeping purposes.',
          ],
        },
        {
          title: 'Changes to the site',
          paragraphs: [
            'We may update services, pages, availability, or features at any time without notice.',
            'Continued use of the site after an update means you accept the updated terms.',
          ],
        },
      ]}
    />
  )
}

export default TermsPage
