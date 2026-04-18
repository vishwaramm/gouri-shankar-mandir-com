const DEFAULT_SERVICE_OFFERINGS = [
  {
    title: 'Virtual Pooja',
    category: 'Prayer',
    keywords: ['pooja', 'devatas', 'devis', 'ritual'],
    body:
      'Online pooja with sankalp support, preparation guidance, and priest coordination for family worship.',
    includes: ['Sankalp review', 'Priest coordination', 'Prayer guidance'],
    contribution: 'Suggested contribution from $51',
    contributionAmountCents: 5100,
    timing: 'Usually confirmed within 1 business day',
    delivery: 'Virtual or guided at home',
  },
  {
    title: 'Yagnas',
    category: 'Prayer',
    keywords: ['yagna', 'fire', 'ritual', 'festival'],
    body:
      'Fire rituals for peace, prosperity, healing, protection, thanksgiving, and milestone observances.',
    includes: ['Ritual planning', 'Material checklist', 'Priestly recitation'],
    contribution: 'Suggested contribution from $151',
    contributionAmountCents: 15100,
    timing: 'Best booked in advance',
    delivery: 'Virtual coordination or temple-led',
  },
  {
    title: 'Astrology',
    category: 'Guidance',
    keywords: ['astrology', 'chart', 'membership', 'consultation'],
    body:
      'One-time chart checking, remedial guidance, and membership-based follow-up for ongoing review.',
    includes: ['Chart review', 'Timing guidance', 'Practical remedies'],
    contribution: 'Suggested contribution from $75',
    contributionAmountCents: 7500,
    timing: 'Review available by appointment',
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
