const DEFAULT_SERVICE_OFFERINGS = [
  {
    title: 'Pooja - Less than 1 hour',
    category: 'Prayer',
    keywords: ['pooja', 'devatas', 'devis', 'ritual', 'under 1 hour'],
    body:
      'Pooja service for shorter observances and focused household worship.',
    includes: ['Prayer guidance', 'Priest coordination', 'Sankalp review'],
    contribution: '$250.00 for less than 1 hour',
    contributionAmountCents: 25000,
    timing: 'Less than 1 hour',
    delivery: 'Virtual or guided at home',
  },
  {
    title: 'Pooja - 1 to 1.75 hours',
    category: 'Prayer',
    keywords: ['pooja', 'devatas', 'devis', 'ritual', '1 to 1.75 hours'],
    body:
      'Pooja service for observances that require a little more time and preparation.',
    includes: ['Prayer guidance', 'Priest coordination', 'Sankalp review'],
    contribution: '$425.00 for 1 to 1.75 hours',
    contributionAmountCents: 42500,
    timing: '1 to 1.75 hours',
    delivery: 'Virtual or guided at home',
  },
  {
    title: 'Pooja - 2 to 2.5 hours',
    category: 'Prayer',
    keywords: ['pooja', 'devatas', 'devis', 'ritual', '2 to 2.5 hours'],
    body:
      'Extended pooja service for fuller household or temple observance.',
    includes: ['Prayer guidance', 'Priest coordination', 'Sankalp review'],
    contribution: '$600.00 for 2 to 2.5 hours',
    contributionAmountCents: 60000,
    timing: '2 to 2.5 hours',
    delivery: 'Virtual or guided at home',
  },
  {
    title: 'Pooja - Over 2.5 hours',
    category: 'Prayer',
    keywords: ['pooja', 'devatas', 'devis', 'ritual', 'over 2.5 hours'],
    body:
      'Longer pooja services are reviewed case by case so the right support can be arranged.',
    includes: ['Prayer guidance', 'Priest coordination', 'Custom review'],
    contribution: 'Custom quote',
    contributionAmountCents: null,
    timing: 'Over 2.5 hours, to be determined',
    delivery: 'Virtual or guided at home',
  },
  {
    title: 'Yagnas - Reading Only',
    category: 'Prayer',
    keywords: ['yagna', 'fire', 'ritual', 'festival', 'reading only'],
    body:
      'Reading-only yagna guidance for peace, prosperity, healing, protection, thanksgiving, and milestone observances.',
    includes: ['Ritual review', 'Priestly recitation', 'Material checklist'],
    contribution: '$575.00 for 1.5 hours',
    contributionAmountCents: 57500,
    timing: '1.5 hours',
    delivery: 'Virtual coordination or temple-led',
  },
  {
    title: 'Astrology Reading - General',
    category: 'Guidance',
    keywords: ['astrology', 'chart', 'one time', 'consultation', 'general'],
    body:
      'General one-time astrology reading for chart review, timing, and practical guidance.',
    includes: ['Chart review', 'Timing guidance', 'Practical remedies'],
    contribution: '$129.00 one time',
    contributionAmountCents: 12900,
    timing: 'One time',
    delivery: 'Remote consultation',
  },
  {
    title: 'Astrology Reading - Special Days',
    category: 'Guidance',
    keywords: ['astrology', 'special days', 'birth', 'death', 'consultation'],
    body:
      'Special-day astrology review for birth, death, and related observances.',
    includes: ['Date review', 'Special observance guidance', 'Practical remedies'],
    contribution: '$79.00 for special days',
    contributionAmountCents: 7900,
    timing: 'By appointment',
    delivery: 'Remote consultation',
  },
  {
    title: 'Meditation',
    category: 'Learning',
    keywords: ['meditation', 'online meditation', 'calm', 'breath'],
    body:
      'Live meditation sessions for beginners and experienced seekers focused on calm and devotional steadiness.',
    includes: ['Guided breath work', 'Mantra practice', 'Session follow-up'],
    contribution: 'Suggested contribution from $25',
    contributionAmountCents: 2500,
    timing: 'Recurring or one-time',
    delivery: 'Live online session',
  },
  {
    title: 'Counseling',
    category: 'Guidance',
    keywords: ['counseling', 'support', 'family', 'transition'],
    body:
      'Spiritual counseling for life transitions, family concerns, grief, and prayer support.',
    includes: ['Private conversation', 'Prayer framing', 'Next-step guidance'],
    contribution: 'Suggested contribution from $40',
    contributionAmountCents: 4000,
    timing: 'By appointment',
    delivery: 'Private remote conversation',
  },
  {
    title: 'Samskaras',
    category: 'Rites',
    keywords: ['samskara', 'ceremony', 'family', 'life event'],
    body:
      'Planning and priestly support for all 16 samskaras, from birth rites to marriage and final rites.',
    includes: ['Ceremony planning', 'Priest support', 'Family preparation'],
    contribution: 'Custom quote',
    contributionAmountCents: null,
    timing: 'Plan well in advance',
    delivery: 'Temple-led or guided virtual planning',
  },
]

function parseServiceConfig() {
  const raw = import.meta.env.VITE_SERVICE_CONFIG_JSON?.trim()
  if (!raw) return {}

  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function normalizeOffering(entry) {
  return {
    title: entry.title || '',
    category: entry.category || 'General',
    keywords: Array.isArray(entry.keywords) ? entry.keywords.filter(Boolean).map(String) : [],
    body: entry.body || '',
    includes: Array.isArray(entry.includes) ? entry.includes.filter(Boolean).map(String) : [],
    contribution: entry.contribution || 'Custom quote',
    contributionAmountCents:
      Number.isInteger(entry.contributionAmountCents) && entry.contributionAmountCents > 0
        ? entry.contributionAmountCents
        : null,
    timing: entry.timing || '',
    delivery: entry.delivery || '',
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function buildContributionGuide(offerings) {
  const byGroup = new Map()

  for (const item of offerings) {
    const key = item.category || 'General'
    const list = byGroup.get(key) || []
    list.push(item)
    byGroup.set(key, list)
  }

  return [...byGroup.entries()].map(([category, items]) => {
    const pricedItems = items.filter((item) => Number.isInteger(item.contributionAmountCents) && item.contributionAmountCents > 0)
    const minAmount = pricedItems.reduce((lowest, item) => Math.min(lowest, item.contributionAmountCents), Number.POSITIVE_INFINITY)
    const amountCents = Number.isFinite(minAmount) ? minAmount : null
    const amount = amountCents
      ? `From $${Math.round(amountCents / 100)}`
      : 'Custom quote'

    return {
      title: `${category} services`,
      detail: `${items.map((item) => item.title).join(', ')}`,
      amount,
      amountCents,
      squareName: `${category} service donation`,
    }
  })
}

const configured = parseServiceConfig()

export const serviceOfferings = Array.isArray(configured.serviceOfferings) && configured.serviceOfferings.length
  ? configured.serviceOfferings.map(normalizeOffering).filter((item) => item.title)
  : DEFAULT_SERVICE_OFFERINGS

export const serviceCards = serviceOfferings.map((item) => ({
  title: item.title,
  category: item.category,
  keywords: item.keywords,
  body: item.body,
}))

export const serviceCategories = ['All', ...unique(serviceOfferings.map((item) => item.category))]

export const serviceOptions = serviceOfferings.map((item) => item.title)

export const serviceContributionGuide = buildContributionGuide(serviceOfferings)
