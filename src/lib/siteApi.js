async function parseJson(response) {
  const contentType = response.headers.get('content-type') || ''

  if (!contentType.includes('application/json')) {
    return { ok: response.ok, message: await response.text() }
  }

  return response.json()
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
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
