import LegalPage from './LegalPage.jsx'

function CommunityGuidelinesPage() {
  return (
    <LegalPage
      kicker="Legal"
      title="Community Guidelines"
      intro="Respectful behavior for posts, messages, and community participation."
      sections={[
        {
          title: 'Be respectful',
          paragraphs: [
            'Use respectful language in comments, posts, requests, and messages.',
            'Do not harass, impersonate, threaten, or abuse officers, staff, or other devotees.',
          ],
        },
        {
          title: 'Keep content appropriate',
          paragraphs: [
            'Do not submit spam, commercial promotion, malicious links, or unlawful material.',
            'Any community content may be removed if it is disruptive, offensive, or inconsistent with temple use.',
          ],
        },
        {
          title: 'Posting and moderation',
          paragraphs: [
            'Temple officers may approve, reject, edit, hide, or remove content when needed for safety, clarity, or operational reasons.',
            'Repeated abuse can result in account restrictions or loss of access to the community features.',
          ],
        },
      ]}
    />
  )
}

export default CommunityGuidelinesPage
