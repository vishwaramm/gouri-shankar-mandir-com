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

export async function bootstrapPriestAuth() {
  return requestJson('/api/priest-auth/bootstrap', {
    method: 'POST',
  })
}

export async function loginPriestAuth(token) {
  return requestJson('/api/priest-auth/login', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

export async function logoutPriestAuth() {
  return requestJson('/api/priest-auth/logout', {
    method: 'POST',
  })
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
