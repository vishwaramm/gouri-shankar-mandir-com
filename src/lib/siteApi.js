async function parseJson(response) {
  const contentType = response.headers.get('content-type') || ''

  if (!contentType.includes('application/json')) {
    return { ok: response.ok, message: await response.text() }
  }

  return response.json()
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  const data = await parseJson(response)
  if (!response.ok) {
    throw new Error(data.message || 'Unable to complete the request.')
  }

  return data
}

export async function loadSiteData() {
  return requestJson('/api/site-data')
}

export async function loadPriestAuthStatus() {
  return requestJson('/api/priest-auth/status')
}

export async function loadCurrentUser() {
  return requestJson('/api/users/me')
}

export async function loadUserOrders() {
  return requestJson('/api/users/orders')
}

export async function lookupOrder(payload) {
  const params = new URLSearchParams()
  params.set('code', payload.code || '')
  if (payload.email) params.set('email', payload.email)
  return requestJson(`/api/orders/lookup?${params.toString()}`)
}

export async function loginPriestAuth(payload) {
  return requestJson('/api/priest-auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function requestPriestAccess(payload) {
  return requestJson('/api/priest-auth/request-access', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function logoutPriestAuth() {
  return requestJson('/api/priest-auth/logout', {
    method: 'POST',
  })
}

export async function signupUser(payload) {
  return requestJson('/api/users/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function loginUser(payload) {
  return requestJson('/api/users/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function logoutUser() {
  return requestJson('/api/users/logout', {
    method: 'POST',
  })
}

export async function requestPasswordReset(payload) {
  return requestJson('/api/users/forgot-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function resetPassword(payload) {
  return requestJson('/api/users/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateUserProfile(payload) {
  return requestJson('/api/users/profile', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function requestOrderChange(payload) {
  return requestJson('/api/orders/request-change', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function changeUserPassword(payload) {
  return requestJson('/api/users/change-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function resendUserVerification() {
  return requestJson('/api/users/resend-verification', {
    method: 'POST',
  })
}

export async function verifyUserEmail(token) {
  return requestJson(`/api/users/verify-email?${new URLSearchParams({ token }).toString()}`)
}

export async function createNewsletter(email) {
  return requestJson('/api/newsletters', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function createServiceRequest(payload) {
  return requestJson('/api/service-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function createSquarePayment(payload) {
  return requestJson('/api/square/payments', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function createPaymentLink(payload) {
  return requestJson('/api/payment-links', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function sendServicePaymentPage(payload) {
  return requestJson('/api/service-requests/send-payment-page', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function markServiceRequestCompleted(payload) {
  return requestJson('/api/service-requests/mark-complete', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function processServiceRefund(payload) {
  return requestJson('/api/service-requests/process-refund', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function processServiceCancellation(payload) {
  return requestJson('/api/service-requests/process-cancellation', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function syncSquareOrders(payload = {}) {
  return requestJson('/api/square/sync', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function sendCustomPaymentPage(payload) {
  return requestJson('/api/custom-payment-pages/send', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function resolvePaymentLink(token) {
  const params = new URLSearchParams()
  params.set('token', token)
  return requestJson(`/api/payment-links/resolve?${params.toString()}`)
}

export async function createRsvp(event) {
  return requestJson('/api/rsvps', {
    method: 'POST',
    body: JSON.stringify({ event }),
  })
}

export async function createContactMessage(payload) {
  return requestJson('/api/contact-email', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
