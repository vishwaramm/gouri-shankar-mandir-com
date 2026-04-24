import LegalPage from './LegalPage.jsx'

function ChildrenPrivacyPage() {
  return (
    <LegalPage
      kicker="Legal"
      title="Children’s Privacy"
      intro="A short notice about information from children and family participation."
      sections={[
        {
          title: 'General audience site',
          paragraphs: [
            'This site is intended for a general temple audience. We do not knowingly target children under 13 as a separate audience.',
            'Parents or guardians should submit information on behalf of minors where appropriate.',
          ],
        },
        {
          title: 'What to avoid',
          paragraphs: [
            'Do not allow a child under 13 to submit personal information to the site without parental or guardian involvement.',
            'If we learn that a child under 13 has submitted personal information, we may remove it and take steps appropriate to the situation.',
          ],
        },
        {
          title: 'Family services',
          paragraphs: [
            'Family services, ceremonies, and community participation may naturally involve children, but account creation and data submission should be handled by an adult.',
          ],
        },
      ]}
    />
  )
}

export default ChildrenPrivacyPage
