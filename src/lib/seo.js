const SITE_NAME = 'Gourishankar Mandir'
const SITE_DESCRIPTION =
  'Gourishankar Mandir offers virtual darshan, sacred services, learning, community, and devotional support.'
const SITE_IMAGE = '/images/og-temple.jpg'

const ROUTE_SEO = {
  '/': {
    title: `${SITE_NAME} | Virtual Darshan, Prayer, Learning, and Satsang`,
    description: SITE_DESCRIPTION,
  },
  '/about': {
    title: `About ${SITE_NAME} | Temple Story and Leadership`,
    description:
      'Read the story of Gourishankar Mandir, its mission, and the leadership guiding prayer, learning, and service.',
  },
  '/services': {
    title: `Services | Pooja, Yagnas, Astrology Readings, and Samskaras`,
    description:
      'Explore pooja tiers, yagna reading, astrology readings, counseling, meditation, and samskara services with suggested contributions.',
  },
  '/education': {
    title: `Education | Scripture, Meditation, and Devotional Study`,
    description:
      'Study scripture, meditation, and devotional practice through teachings, reading, and guided learning.',
  },
  '/community': {
    title: `Community | Satsang, Membership, and Gatherings`,
    description:
      'Join satsang, observe festivals, and stay connected through community gatherings and membership paths.',
  },
  '/resources': {
    title: `Resources | Prayers, Festival Dates, and Teaching Materials`,
    description:
      'Find prayers, sacred texts, festival dates, and temple resources for daily devotion and study.',
  },
  '/contact': {
    title: `Contact | Write to ${SITE_NAME}`,
    description:
      'Send a message, subscribe for temple letters, or ask for blessings and arrangements.',
  },
  '/payments': {
    title: `Payments | ${SITE_NAME}`,
    description:
      'Complete a secure donation for a selected service or contribution.',
    robots: 'noindex, nofollow',
  },
  '/priest-review': {
    title: `Priest Access | ${SITE_NAME}`,
    description: 'Generate or enter the priest access code before opening the private tools page.',
    robots: 'noindex, nofollow',
  },
  '/priest-tools': {
    title: `Priest Tools | ${SITE_NAME}`,
    description: 'Review requests and open payment request or custom payment pages after unlocking priest access.',
    robots: 'noindex, nofollow',
  },
  '/priest-payment-request': {
    title: `Payment Request | ${SITE_NAME}`,
    description: 'Generate and send a payment page for an approved service request.',
    robots: 'noindex, nofollow',
  },
  '/priest-custom-payment': {
    title: `Custom Payment | ${SITE_NAME}`,
    description: 'Generate and send a payment page to a custom customer without a request record.',
    robots: 'noindex, nofollow',
  },
}

function getSiteOrigin() {
  const configured = import.meta.env.VITE_SITE_URL?.trim().replace(/\/$/, '')
  if (configured) return configured

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  return 'https://gourishankarmandir.com'
}

function ensureMeta(selector, attrName, value) {
  if (!value) return

  let element = document.head.querySelector(selector)
  if (!element) {
    element = document.createElement('meta')
    document.head.appendChild(element)
  }

  element.setAttribute(attrName, value)
}

function ensureCanonical(href) {
  let link = document.head.querySelector('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.setAttribute('rel', 'canonical')
    document.head.appendChild(link)
  }

  link.setAttribute('href', href)
}

export function applySeoForPath(pathname, search = '') {
  const route = ROUTE_SEO[pathname] || ROUTE_SEO['/']
  const origin = getSiteOrigin()
  const canonical = new URL(`${pathname}${search}`, origin).toString()

  document.title = route.title || SITE_NAME

  ensureMeta('meta[name="description"]', 'name', 'description')
  document.head.querySelector('meta[name="description"]')?.setAttribute('content', route.description || SITE_DESCRIPTION)

  ensureMeta('meta[name="robots"]', 'name', 'robots')
  document.head.querySelector('meta[name="robots"]')?.setAttribute('content', route.robots || 'index, follow')

  ensureMeta('meta[property="og:title"]', 'property', 'og:title')
  document.head.querySelector('meta[property="og:title"]')?.setAttribute('content', route.title || SITE_NAME)

  ensureMeta('meta[property="og:description"]', 'property', 'og:description')
  document.head.querySelector('meta[property="og:description"]')?.setAttribute(
    'content',
    route.description || SITE_DESCRIPTION,
  )

  ensureMeta('meta[property="og:type"]', 'property', 'og:type')
  document.head.querySelector('meta[property="og:type"]')?.setAttribute('content', 'website')

  ensureMeta('meta[property="og:site_name"]', 'property', 'og:site_name')
  document.head.querySelector('meta[property="og:site_name"]')?.setAttribute('content', SITE_NAME)

  ensureMeta('meta[property="og:image"]', 'property', 'og:image')
  const imageUrl = new URL(SITE_IMAGE, origin).toString()
  document.head.querySelector('meta[property="og:image"]')?.setAttribute('content', imageUrl)

  ensureMeta('meta[property="og:image:secure_url"]', 'property', 'og:image:secure_url')
  document.head.querySelector('meta[property="og:image:secure_url"]')?.setAttribute('content', imageUrl)

  ensureMeta('meta[property="og:image:alt"]', 'property', 'og:image:alt')
  document.head.querySelector('meta[property="og:image:alt"]')?.setAttribute(
    'content',
    'Gourishankar Mandir temple view',
  )

  ensureMeta('meta[property="og:url"]', 'property', 'og:url')
  document.head.querySelector('meta[property="og:url"]')?.setAttribute('content', canonical)

  ensureMeta('meta[name="twitter:card"]', 'name', 'twitter:card')
  document.head.querySelector('meta[name="twitter:card"]')?.setAttribute('content', 'summary_large_image')

  ensureMeta('meta[name="twitter:image"]', 'name', 'twitter:image')
  document.head.querySelector('meta[name="twitter:image"]')?.setAttribute('content', imageUrl)

  ensureMeta('meta[name="twitter:image:alt"]', 'name', 'twitter:image:alt')
  document.head.querySelector('meta[name="twitter:image:alt"]')?.setAttribute(
    'content',
    'Gourishankar Mandir temple view',
  )

  ensureMeta('meta[name="twitter:title"]', 'name', 'twitter:title')
  document.head.querySelector('meta[name="twitter:title"]')?.setAttribute('content', route.title || SITE_NAME)

  ensureMeta('meta[name="twitter:description"]', 'name', 'twitter:description')
  document.head.querySelector('meta[name="twitter:description"]')?.setAttribute(
    'content',
    route.description || SITE_DESCRIPTION,
  )

  ensureCanonical(canonical)

  return {
    title: route.title || SITE_NAME,
    description: route.description || SITE_DESCRIPTION,
    canonical,
    robots: route.robots || 'index, follow',
  }
}
