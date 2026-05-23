const VISITOR_ID_KEY = 'gourishankar_mandir_visitor_id'

function getLocalStorageValue(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return ''
  }
}

function setLocalStorageValue(key, value) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Ignore storage failures in private/incognito contexts.
  }
}

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function getVisitorId() {
  if (typeof window === 'undefined') return ''

  const existing = getLocalStorageValue(VISITOR_ID_KEY)
  if (existing) return existing

  const visitorId = generateId()
  setLocalStorageValue(VISITOR_ID_KEY, visitorId)
  return visitorId
}

export function trackPageView(payload = {}) {
  if (typeof window === 'undefined') return

  const body = JSON.stringify({
    visitorId: getVisitorId(),
    path: typeof payload.path === 'string' ? payload.path.trim() : window.location.pathname,
    search: typeof payload.search === 'string' ? payload.search.trim() : window.location.search,
    pageTitle: typeof payload.pageTitle === 'string' ? payload.pageTitle.trim() : document.title,
    referrer: typeof payload.referrer === 'string' ? payload.referrer.trim() : document.referrer || '',
    contentType: typeof payload.contentType === 'string' ? payload.contentType.trim() : 'page',
    contentId: typeof payload.contentId === 'string' ? payload.contentId.trim() : '',
    isAdminRoute: Boolean(payload.isAdminRoute),
    userAgent: navigator.userAgent,
    language: navigator.language || '',
    viewportWidth: Number(window.innerWidth || 0),
    viewportHeight: Number(window.innerHeight || 0),
    recordedAt: new Date().toISOString(),
  })

  if (typeof navigator.sendBeacon === 'function') {
    navigator.sendBeacon('/api/analytics/pageview', new Blob([body], { type: 'application/json' }))
    return
  }

  void fetch('/api/analytics/pageview', {
    method: 'POST',
    credentials: 'same-origin',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  }).catch(() => {})
}
