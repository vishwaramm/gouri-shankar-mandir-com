import nodemailer from 'nodemailer'
import { MongoClient } from 'mongodb'
import { createHash, randomBytes, randomUUID } from 'node:crypto'

const RECIPIENT_EMAIL = 'drgsm@hotmail.com'
const DEFAULT_SUPER_USER_EMAIL = 'vishwaramm@gmail.com'

function getPriestAccessRecipients(env) {
  const superUser = env.PRIEST_SUPER_USER_EMAIL?.trim() || DEFAULT_SUPER_USER_EMAIL
  const priestInbox = env.PRIEST_REVIEW_RECIPIENT_EMAIL?.trim() || RECIPIENT_EMAIL
  const isProduction = env.NODE_ENV === 'production'

  return isProduction ? [priestInbox, superUser].filter(Boolean) : [superUser].filter(Boolean)
}

let mongoClient
let mongoDbPromise

const memoryStore = {
  newsletters: [],
  serviceRequests: [],
  paymentLinks: [],
  rsvps: [],
  contactMessages: [],
  priestAuth: {
    tokenHash: '',
    tokenCreatedAt: '',
    sessions: [],
  },
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json')
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Pragma', 'no-cache')
  response.end(JSON.stringify(payload))
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''

    request.on('data', (chunk) => {
      body += chunk
    })

    request.on('end', () => {
      if (!body) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(body))
      } catch (error) {
        reject(error)
      }
    })

    request.on('error', reject)
  })
}

async function getDb(env) {
  const mongoUri = env.MONGODB_URI?.trim() || ''
  const mongoDbName = env.MONGODB_DB || 'gourishankar_mandir'

  if (!mongoUri) return null

  if (!mongoDbPromise) {
    mongoClient = new MongoClient(mongoUri)
    mongoDbPromise = mongoClient
      .connect()
      .then(async (client) => {
        const db = client.db(mongoDbName)

        await Promise.all([
          db.collection('newsletters').createIndex({ email: 1 }, { unique: true }),
          db.collection('serviceRequests').createIndex({ id: 1 }),
          db.collection('serviceRequests').createIndex({ createdAt: -1 }),
          db.collection('paymentLinks').createIndex({ tokenHash: 1 }, { unique: true }),
          db.collection('paymentLinks').createIndex({ createdAt: -1 }),
          db.collection('paymentLinks').createIndex({ expiresAt: 1 }),
          db.collection('rsvps').createIndex({ createdAt: -1 }),
          db.collection('contactMessages').createIndex({ createdAt: -1 }),
        ])

        return db
      })
      .catch((error) => {
        console.error('MongoDB connection failed, falling back to in-memory storage:', error)
        mongoClient = null
        mongoDbPromise = null
        return null
      })
  }

  return mongoDbPromise
}

async function listCollection(db, name) {
  return db.collection(name).find({}).sort({ createdAt: -1 }).limit(20).toArray()
}

async function savePaymentLink(db, entry) {
  if (db) {
    await db.collection('paymentLinks').insertOne(entry)
  } else {
    memoryStore.paymentLinks.unshift(entry)
  }
}

async function findPaymentLinkByToken(db, token) {
  const tokenHash = hashSecret(token)
  if (db) {
    const entry = await db.collection('paymentLinks').findOne({ tokenHash })
    if (!entry) return null
    if (entry.expiresAt && new Date(entry.expiresAt).getTime() <= Date.now()) {
      await db.collection('paymentLinks').deleteOne({ tokenHash })
      return null
    }
    return entry
  }

  const entry = memoryStore.paymentLinks.find((item) => item.tokenHash === tokenHash) || null
  if (!entry) return null
  if (entry.expiresAt && new Date(entry.expiresAt).getTime() <= Date.now()) {
    memoryStore.paymentLinks = memoryStore.paymentLinks.filter((item) => item.tokenHash !== tokenHash)
    return null
  }
  return entry
}

function getSettingsCollection(db) {
  return db.collection('settings')
}

function getSessionsCollection(db) {
  return db.collection('priestSessions')
}

function hashSecret(value) {
  return createHash('sha256').update(String(value)).digest('hex')
}

function generateSecret(lengthBytes = 32) {
  return randomBytes(lengthBytes).toString('base64url')
}

function parseCookies(request) {
  const header = request.headers.cookie || ''
  return header.split(';').reduce((cookies, pair) => {
    const [rawName, ...rawValueParts] = pair.split('=')
    const name = rawName?.trim()
    if (!name) return cookies
    const value = rawValueParts.join('=').trim()
    try {
      cookies[name] = decodeURIComponent(value || '')
    } catch {
      cookies[name] = value || ''
    }
    return cookies
  }, {})
}

function getCookie(request, name) {
  return parseCookies(request)[name] || ''
}

function setCookie(response, name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`]
  parts.push(`Path=${options.path || '/'}`)
  if (options.maxAge) parts.push(`Max-Age=${Math.floor(options.maxAge)}`)
  if (options.httpOnly !== false) parts.push('HttpOnly')
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`)
  if (options.secure) parts.push('Secure')

  const existing = response.getHeader('Set-Cookie')
  const next = Array.isArray(existing)
    ? [...existing, parts.join('; ')]
    : existing
      ? [existing, parts.join('; ')]
      : [parts.join('; ')]
  response.setHeader('Set-Cookie', next)
}

function getRequestProtocol(request, env) {
  const forwarded = request.headers['x-forwarded-proto']
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.trim()
  if (env.SITE_URL?.trim().startsWith('https://')) return 'https'
  return 'http'
}

function getRequestOrigin(request, env) {
  const host = request.headers['x-forwarded-host'] || request.headers.host || ''
  if (!host) return ''
  return `${getRequestProtocol(request, env)}://${String(host).trim().replace(/\/$/, '')}`
}

function getConfiguredOrigin(env) {
  const configured = env.SITE_URL?.trim() || env.PUBLIC_SITE_URL?.trim() || env.VITE_SITE_URL?.trim()
  return configured ? configured.replace(/\/$/, '') : ''
}

function isSameOriginRequest(request, env) {
  const requestOrigin = request.headers.origin?.trim()
  if (!requestOrigin) return true

  const expectedOrigin = getConfiguredOrigin(env) || getRequestOrigin(request, env)
  return requestOrigin.replace(/\/$/, '') === expectedOrigin
}

function getSessionCookieOptions(request, env) {
  return {
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'Strict',
    secure: getRequestProtocol(request, env) === 'https',
  }
}

async function getPriestAuthState(db) {
  const doc = db ? await getSettingsCollection(db).findOne({ _id: 'priest-review' }) : null
  const memory = memoryStore.priestAuth
  return {
    tokenHash: doc?.tokenHash || memory.tokenHash || '',
    tokenCreatedAt: doc?.tokenCreatedAt || memory.tokenCreatedAt || '',
  }
}

async function savePriestAuthToken(db, tokenHash) {
  const tokenCreatedAt = new Date().toISOString()
  if (db) {
    await getSettingsCollection(db).updateOne(
      { _id: 'priest-review' },
      { $set: { tokenHash, tokenCreatedAt } },
      { upsert: true },
    )
  } else {
    memoryStore.priestAuth.tokenHash = tokenHash
    memoryStore.priestAuth.tokenCreatedAt = tokenCreatedAt
  }
  return { tokenHash, tokenCreatedAt }
}

async function createPriestSession(db) {
  const sessionId = generateSecret(32)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
  const entry = {
    sessionId,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
  }

  if (db) {
    await getSessionsCollection(db).insertOne(entry)
  } else {
    memoryStore.priestAuth.sessions.unshift(entry)
  }

  return entry
}

async function getPriestSession(db, sessionId) {
  if (!sessionId) return null

  if (db) {
    const session = await getSessionsCollection(db).findOne({ sessionId })
    if (!session) return null
    if (new Date(session.expiresAt).getTime() <= Date.now()) return null
    return session
  }

  const session = memoryStore.priestAuth.sessions.find((item) => item.sessionId === sessionId)
  if (!session) return null
  if (new Date(session.expiresAt).getTime() <= Date.now()) return null
  return session
}

async function isPriestAuthenticated(db, request) {
  const sessionId = getCookie(request, 'priest_review_session')
  return getPriestSession(db, sessionId)
}

async function requirePriestAuth(db, request, response) {
  const session = await isPriestAuthenticated(db, request)
  if (!session) {
    sendJson(response, 401, { ok: false, message: 'Unauthorized.' })
    return false
  }

  return true
}

function requireSameOrigin(request, env, response) {
  if (isSameOriginRequest(request, env)) return true
  sendJson(response, 403, { ok: false, message: 'Forbidden.' })
  return false
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function getSquareBaseUrl(env) {
  const configured = env.SQUARE_BASE_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')

  return env.SQUARE_ENVIRONMENT?.trim().toLowerCase() === 'sandbox'
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com'
}

function getPublicSiteOrigin(env, request) {
  const requestOrigin = request?.headers?.origin?.trim()
  if (requestOrigin) return requestOrigin.replace(/\/$/, '')

  const configured = env.SITE_URL?.trim() || env.PUBLIC_SITE_URL?.trim() || env.VITE_SITE_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')

  return 'https://gourishankarmandir.com'
}

async function buildSecurePaymentPageUrl(env, request, payload, db) {
  const token = generateSecret(24)
  const tokenHash = hashSecret(token)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString()
  const entry = {
    tokenHash,
    type: payload.type || 'custom',
    service: payload.service || '',
    amountCents: payload.amountCents || 0,
    name: payload.name || '',
    email: payload.email || '',
    phone: payload.phone || '',
    requestId: payload.requestId || '',
    note: payload.note || '',
    createdAt: new Date().toISOString(),
    expiresAt,
  }

  await savePaymentLink(db, entry)

  const url = new URL('/payments', getPublicSiteOrigin(env, request))
  url.searchParams.set('token', token)

  return {
    url: url.toString(),
    token,
    entry,
  }
}

async function createSquarePayment(env, { amountCents, sourceId, note, buyerEmailAddress, buyerPhoneNumber }) {
  const accessToken = env.SQUARE_ACCESS_TOKEN?.trim()
  const locationId = env.SQUARE_LOCATION_ID?.trim()

  if (!accessToken || !locationId) {
    return { ok: false, reason: 'missing_square_config' }
  }

  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, reason: 'invalid_amount' }
  }

  if (!sourceId?.trim()) {
    return { ok: false, reason: 'missing_source' }
  }

  const response = await fetch(`${getSquareBaseUrl(env)}/v2/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Square-Version': env.SQUARE_VERSION || '2026-01-22',
    },
    body: JSON.stringify({
      idempotency_key: randomUUID(),
      source_id: sourceId,
      amount_money: {
        amount: amountCents,
        currency: 'USD',
      },
      location_id: locationId,
      note,
      buyer_email_address: buyerEmailAddress || undefined,
      buyer_phone_number: buyerPhoneNumber || undefined,
    }),
  })

  const text = await response.text()
  let data = {}

  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { errors: [{ detail: text || 'Square returned an invalid response.' }] }
  }

  if (!response.ok) {
    const squareError = data?.errors?.[0]?.detail || data?.message || 'Unable to create Square payment.'
    return { ok: false, reason: 'square_error', message: squareError }
  }

  const payment = data.payment || {}
  return {
    ok: true,
    payment,
  }
}

async function sendMail(env, { to = RECIPIENT_EMAIL, subject, text, html, replyTo }) {
  const smtpHost = env.SMTP_HOST
  const smtpPort = Number(env.SMTP_PORT || 587)
  const smtpSecure = env.SMTP_SECURE === 'true'
  const smtpUser = env.SMTP_USER
  const smtpPass = env.SMTP_PASS
  const smtpConfigured = Boolean(smtpHost && smtpUser && smtpPass)

  if (!smtpConfigured) {
    return { sent: false, reason: 'missing_smtp' }
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  })

  try {
    await transporter.sendMail({
      from: env.SMTP_FROM || 'Gourishankar Mandir <no-reply@gourishankar-mandir.com>',
      to,
      replyTo,
      subject,
      text,
      html,
    })

    return { sent: true, reason: 'sent' }
  } catch (error) {
    return {
      sent: false,
      reason: 'smtp_error',
      errorMessage: error?.message || 'SMTP delivery failed.',
    }
  }
}

export async function handleSiteApi(request, response, pathname, env = {}) {
  const db = await getDb(env)
  const usingMongo = Boolean(db)

  if (request.method === 'GET' && pathname === '/api/site-data') {
    if (!(await requirePriestAuth(db, request, response))) return true
    if (!requireSameOrigin(request, env, response)) return true

    const [newsletters, serviceRequests, rsvps, contactMessages] = usingMongo
      ? await Promise.all([
          listCollection(db, 'newsletters'),
          listCollection(db, 'serviceRequests'),
          listCollection(db, 'rsvps'),
          listCollection(db, 'contactMessages'),
        ])
      : [
          [...memoryStore.newsletters].slice(0, 20),
          [...memoryStore.serviceRequests].slice(0, 20),
          [...memoryStore.rsvps].slice(0, 20),
          [...memoryStore.contactMessages].slice(0, 20),
        ]

    sendJson(response, 200, {
      newsletters: newsletters.map((item) => ({
        email: item.email,
        createdAt: item.createdAt,
      })),
      serviceRequests: serviceRequests.map((item) => ({
        id: item.id || '',
        service: item.service,
        name: item.name,
        email: item.email,
        phone: item.phone || '',
        date: item.date || '',
        note: item.note,
        reviewedAt: item.reviewedAt || '',
        paymentPageSentAt: item.paymentPageSentAt || '',
        paymentPageAmountCents: item.paymentPageAmountCents || 0,
        createdAt: item.createdAt,
      })),
      rsvps: rsvps.map((item) => ({
        event: item.event,
        createdAt: item.createdAt,
      })),
      contactMessages: contactMessages.map((item) => ({
        name: item.name,
        email: item.email,
        phone: item.phone || '',
        subject: item.subject || '',
        message: item.message,
        createdAt: item.createdAt,
      })),
    })
    return true
  }

  if (request.method === 'GET' && pathname === '/api/payment-links/resolve') {
    const token = new URL(request.url, 'http://localhost').searchParams.get('token')?.trim() || ''

    if (!token) {
      sendJson(response, 400, { ok: false, message: 'Token is required.' })
      return true
    }

    const entry = await findPaymentLinkByToken(db, token)
    if (!entry) {
      sendJson(response, 404, { ok: false, message: 'Payment link not found.' })
      return true
    }

    sendJson(response, 200, {
      ok: true,
      paymentLink: {
        type: entry.type || 'custom',
        service: entry.service || '',
        amountCents: entry.amountCents || 0,
        name: entry.name || '',
        email: entry.email || '',
        phone: entry.phone || '',
        requestId: entry.requestId || '',
        note: entry.note || '',
        createdAt: entry.createdAt || '',
      },
    })
    return true
  }

  if (request.method === 'DELETE' && pathname === '/api/site-data') {
    if (!(await requirePriestAuth(db, request, response))) return true

    if (usingMongo) {
      await Promise.all([
        db.collection('newsletters').deleteMany({}),
        db.collection('serviceRequests').deleteMany({}),
        db.collection('paymentLinks').deleteMany({}),
        db.collection('rsvps').deleteMany({}),
        db.collection('contactMessages').deleteMany({}),
      ])
    } else {
      memoryStore.newsletters = []
      memoryStore.serviceRequests = []
      memoryStore.paymentLinks = []
      memoryStore.rsvps = []
      memoryStore.contactMessages = []
    }

    sendJson(response, 200, { ok: true })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/newsletters') {
    const body = await readJsonBody(request)
    const email = normalizeEmail(body.email)

    if (!email) {
      sendJson(response, 400, { ok: false, message: 'Email is required.' })
      return true
    }

    const entry = {
      email,
      createdAt: new Date().toISOString(),
    }

    if (usingMongo) {
      await db.collection('newsletters').updateOne(
        { email },
        { $setOnInsert: entry },
        { upsert: true },
      )
    } else if (!memoryStore.newsletters.some((item) => item.email === email)) {
      memoryStore.newsletters.unshift(entry)
    }

    sendJson(response, 200, { ok: true, message: 'Received.', entry })
    return true
  }

  if (request.method === 'GET' && pathname === '/api/priest-auth/status') {
    const state = await getPriestAuthState(db)
    const authenticated = Boolean(await isPriestAuthenticated(db, request))
    sendJson(response, 200, {
      ok: true,
      configured: Boolean(state.tokenHash),
      authenticated,
    })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/priest-auth/bootstrap') {
    if (!requireSameOrigin(request, env, response)) return true

    const state = await getPriestAuthState(db)
    if (state.tokenHash) {
      sendJson(response, 409, { ok: false, message: 'Priest access is already configured.' })
      return true
    }

    const token = generateSecret(24)
    const tokenHash = hashSecret(token)
    await savePriestAuthToken(db, tokenHash)

    const mailResult = await sendMail(env, {
      to: getPriestAccessRecipients(env),
      subject: 'Gourishankar Mandir priest access token',
      text: [
        'Your priest review access token is ready.',
        '',
        `Token: ${token}`,
        '',
        'Use it on the /priest-review page to unlock the request queue.',
        'Keep this token private.',
      ].join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f1b18">
          <h2 style="margin: 0 0 12px">Priest access token</h2>
          <p style="margin: 0 0 8px">Your priest review access token is ready.</p>
          <p style="margin: 0 0 12px"><strong>Token:</strong> ${escapeHtml(token)}</p>
          <p style="margin: 0 0 8px">Use it on the <strong>/priest-review</strong> page to unlock the queue.</p>
          <p style="margin: 0">Keep this token private.</p>
        </div>
      `,
      replyTo: RECIPIENT_EMAIL,
    })

    sendJson(response, 200, {
      ok: true,
      message: mailResult.sent
        ? 'Access token generated and emailed.'
        : 'Access token generated. Email delivery failed, so the code is shown once.',
      emailed: mailResult.sent,
      mailStatus: mailResult.reason,
      mailError: mailResult.errorMessage || '',
      token: mailResult.sent && env.NODE_ENV === 'production' ? '' : token,
    })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/priest-auth/login') {
    if (!requireSameOrigin(request, env, response)) return true

    const body = await readJsonBody(request)
    const token = typeof body.token === 'string' ? body.token.trim() : ''

    if (!token) {
      sendJson(response, 400, { ok: false, message: 'Token is required.' })
      return true
    }

    const state = await getPriestAuthState(db)
    if (!state.tokenHash || hashSecret(token) !== state.tokenHash) {
      sendJson(response, 401, { ok: false, message: 'Invalid token.' })
      return true
    }

    const session = await createPriestSession(db)
    setCookie(response, 'priest_review_session', session.sessionId, getSessionCookieOptions(request, env))

    sendJson(response, 200, { ok: true, message: 'Unlocked.' })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/priest-auth/logout') {
    if (!requireSameOrigin(request, env, response)) return true

    const sessionId = getCookie(request, 'priest_review_session')
    if (sessionId) {
      if (usingMongo) {
        await getSessionsCollection(db).deleteOne({ sessionId })
      } else {
        memoryStore.priestAuth.sessions = memoryStore.priestAuth.sessions.filter(
          (item) => item.sessionId !== sessionId,
        )
      }
    }

    setCookie(response, 'priest_review_session', '', {
      path: '/',
      maxAge: 0,
      sameSite: 'Strict',
      secure: getRequestProtocol(request, env) === 'https',
    })

    sendJson(response, 200, { ok: true, message: 'Logged out.' })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/service-requests') {
    const body = await readJsonBody(request)
    const id = randomUUID()
    const service = typeof body.service === 'string' ? body.service.trim() : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = normalizeEmail(body.email)
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const date = typeof body.date === 'string' ? body.date.trim() : ''
    const note = typeof body.note === 'string' ? body.note.trim() : ''

    if (!service || !name || !email || !note) {
      sendJson(response, 400, { ok: false, message: 'Service, name, email, and note are required.' })
      return true
    }

    const entry = {
      id,
      service,
      name,
      email,
      phone,
      date,
      note,
      reviewedAt: '',
      paymentPageSentAt: '',
      paymentPageAmountCents: 0,
      createdAt: new Date().toISOString(),
    }

    if (usingMongo) {
      await db.collection('serviceRequests').insertOne(entry)
    } else {
      memoryStore.serviceRequests.unshift(entry)
    }

    const subject = `Gourishankar Mandir service request: ${service}`
    const text = `Service: ${service}\nName: ${name}\nEmail: ${email}\nPhone: ${phone || 'Not provided'}\nDate: ${date || 'Not selected'}\n\n${note}`
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f1b18">
        <h2 style="margin: 0 0 12px">Gourishankar Mandir service request</h2>
        <p style="margin: 0 0 8px"><strong>Service:</strong> ${escapeHtml(service)}</p>
        <p style="margin: 0 0 8px"><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p style="margin: 0 0 8px"><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p style="margin: 0 0 8px"><strong>Phone:</strong> ${escapeHtml(phone || 'Not provided')}</p>
        <p style="margin: 0 0 8px"><strong>Date:</strong> ${escapeHtml(date || 'Not selected')}</p>
        <p style="white-space: pre-wrap; margin: 16px 0 0">${escapeHtml(note).replaceAll('\n', '<br />')}</p>
      </div>
    `

    const mailResult = await sendMail(env, {
      subject,
      text,
      html,
      replyTo: email,
    })

    sendJson(response, 200, {
      ok: true,
      message: 'Received.',
      emailed: mailResult.sent,
      mailStatus: mailResult.reason,
      mailError: mailResult.errorMessage || '',
      entry,
    })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/service-requests/send-payment-page') {
    if (!(await requirePriestAuth(db, request, response))) return true
    if (!requireSameOrigin(request, env, response)) return true

    const body = await readJsonBody(request)
    const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : ''
    const amountCents = Number(body.amountCents)
    const note = typeof body.note === 'string' ? body.note.trim() : ''

    if (!requestId || !Number.isInteger(amountCents) || amountCents <= 0) {
      sendJson(response, 400, { ok: false, message: 'Request id and amount are required.' })
      return true
    }

    const collection = usingMongo ? db.collection('serviceRequests') : null
    const entry = usingMongo
      ? await collection.findOne({ id: requestId })
      : memoryStore.serviceRequests.find((item) => item.id === requestId)

    if (!entry) {
      sendJson(response, 404, { ok: false, message: 'Service request not found.' })
      return true
    }

    const paymentLink = await buildSecurePaymentPageUrl(
      env,
      request,
      {
        type: 'service-request',
        service: entry.service,
        amountCents,
        name: entry.name,
        email: entry.email,
        phone: entry.phone,
        requestId: entry.id,
        note,
      },
      db,
    )
    const paymentPageUrl = paymentLink.url
    const subject = `Your Gourishankar Mandir payment page is ready`
    const text = [
      `Namaste ${entry.name},`,
      '',
      `The priests reviewed your ${entry.service} request.`,
      `You can complete the donation here: ${paymentPageUrl}`,
      '',
      note ? `Priest note: ${note}` : '',
      '',
      'If you have questions, please reply to this email.',
    ]
      .filter(Boolean)
      .join('\n')
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f1b18">
        <h2 style="margin: 0 0 12px">Your payment page is ready</h2>
        <p style="margin: 0 0 8px">Namaste ${escapeHtml(entry.name)},</p>
        <p style="margin: 0 0 8px">
          The priests reviewed your <strong>${escapeHtml(entry.service)}</strong> request.
        </p>
        <p style="margin: 0 0 12px">
          Complete the donation here:
          <a href="${escapeHtml(paymentPageUrl)}">${escapeHtml(paymentPageUrl)}</a>
        </p>
        ${note ? `<p style="margin: 0 0 12px"><strong>Priest note:</strong> ${escapeHtml(note)}</p>` : ''}
        <p style="margin: 0">If you have questions, please reply to this email.</p>
      </div>
    `

    const mailResult = await sendMail(env, {
      to: entry.email,
      subject,
      text,
      html,
      replyTo: RECIPIENT_EMAIL,
    })

    const updatedAt = new Date().toISOString()
    const update = {
      reviewedAt: updatedAt,
      paymentPageSentAt: updatedAt,
      paymentPageAmountCents: amountCents,
    }

    if (usingMongo) {
      await collection.updateOne({ id: requestId }, { $set: update })
    } else {
      Object.assign(entry, update)
    }

    sendJson(response, 200, {
      ok: true,
      message: mailResult.sent ? 'Payment page sent.' : 'Payment page created.',
      emailSent: mailResult.sent,
      mailStatus: mailResult.reason,
      mailError: mailResult.errorMessage || '',
      paymentPageUrl,
      paymentLinkToken: paymentLink.token,
      entry: {
        ...entry,
        ...update,
      },
    })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/custom-payment-pages/send') {
    if (!(await requirePriestAuth(db, request, response))) return true
    if (!requireSameOrigin(request, env, response)) return true

    const body = await readJsonBody(request)
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = normalizeEmail(body.email)
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const serviceLabel = typeof body.serviceLabel === 'string' ? body.serviceLabel.trim() : ''
    const note = typeof body.note === 'string' ? body.note.trim() : ''
    const amountCents = Number(body.amountCents)

    if (!name || !email || !Number.isInteger(amountCents) || amountCents <= 0) {
      sendJson(response, 400, {
        ok: false,
        message: 'Name, email, and amount are required.',
      })
      return true
    }

    const paymentLink = await buildSecurePaymentPageUrl(
      env,
      request,
      {
        type: 'custom-payment',
        service: serviceLabel || 'Custom payment',
        amountCents,
        name,
        email,
        phone,
        note,
      },
      db,
    )
    const paymentPageUrl = paymentLink.url
    const subject = `Your Gourishankar Mandir payment page is ready`
    const text = [
      `Namaste ${name},`,
      '',
      `Your payment page is ready.`,
      `You can complete the donation here: ${paymentPageUrl}`,
      '',
      note ? `Note: ${note}` : '',
      '',
      'If you have questions, please reply to this email.',
    ]
      .filter(Boolean)
      .join('\n')
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f1b18">
        <h2 style="margin: 0 0 12px">Your payment page is ready</h2>
        <p style="margin: 0 0 8px">Namaste ${escapeHtml(name)},</p>
        <p style="margin: 0 0 8px">Your payment page is ready.</p>
        <p style="margin: 0 0 12px">
          Complete the donation here:
          <a href="${escapeHtml(paymentPageUrl)}">${escapeHtml(paymentPageUrl)}</a>
        </p>
        ${note ? `<p style="margin: 0 0 12px"><strong>Note:</strong> ${escapeHtml(note)}</p>` : ''}
        <p style="margin: 0">If you have questions, please reply to this email.</p>
      </div>
    `

    const mailResult = await sendMail(env, {
      to: email,
      subject,
      text,
      html,
      replyTo: RECIPIENT_EMAIL,
    })

    sendJson(response, 200, {
      ok: true,
      message: mailResult.sent ? 'Custom payment page sent.' : 'Custom payment page created.',
      emailSent: mailResult.sent,
      mailStatus: mailResult.reason,
      mailError: mailResult.errorMessage || '',
      paymentPageUrl,
      paymentLinkToken: paymentLink.token,
    })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/square/payments') {
    const body = await readJsonBody(request)
    const amountCents = Number(body.amountCents)
    const sourceId = typeof body.sourceId === 'string' ? body.sourceId.trim() : ''
    const note = typeof body.note === 'string' ? body.note.trim() : ''
    const buyerEmailAddress = typeof body.buyerEmailAddress === 'string' ? body.buyerEmailAddress.trim() : ''
    const buyerPhoneNumber = typeof body.buyerPhoneNumber === 'string' ? body.buyerPhoneNumber.trim() : ''

    if (!Number.isInteger(amountCents) || amountCents <= 0 || !sourceId) {
      sendJson(response, 400, {
        ok: false,
        message: 'Amount and payment token are required.',
      })
      return true
    }

    const result = await createSquarePayment(env, {
      amountCents,
      sourceId,
      note,
      buyerEmailAddress,
      buyerPhoneNumber,
    })

    if (!result.ok) {
      const status = result.reason === 'missing_square_config' ? 501 : 502
      sendJson(response, status, {
        ok: false,
        message:
          result.reason === 'missing_square_config'
            ? 'Square payment is not configured.'
            : result.reason === 'missing_source'
              ? 'Square payment token is required.'
              : result.message || 'Unable to create Square payment.',
      })
      return true
    }

    sendJson(response, 200, {
      ok: true,
      message: 'Received.',
      payment: result.payment,
    })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/rsvps') {
    const body = await readJsonBody(request)
    const event = typeof body.event === 'string' ? body.event.trim() : ''

    if (!event) {
      sendJson(response, 400, { ok: false, message: 'Event is required.' })
      return true
    }

    const entry = {
      event,
      createdAt: new Date().toISOString(),
    }

    if (usingMongo) {
      await db.collection('rsvps').insertOne(entry)
    } else {
      memoryStore.rsvps.unshift(entry)
    }

    sendJson(response, 200, { ok: true, message: 'Received.', entry })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/contact-email') {
    const body = await readJsonBody(request)
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = normalizeEmail(body.email)
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
    const message = typeof body.message === 'string' ? body.message.trim() : ''

    if (!name || !email || !message) {
      sendJson(response, 400, { ok: false, message: 'Name, email, and message are required.' })
      return true
    }

    const entry = {
      name,
      email,
      phone,
      subject,
      message,
      createdAt: new Date().toISOString(),
    }

    if (usingMongo) {
      await db.collection('contactMessages').insertOne(entry)
    } else {
      memoryStore.contactMessages.unshift(entry)
    }

    const finalSubject = subject ? `Gourishankar Mandir: ${subject}` : 'Gourishankar Mandir message'
    const text = `Name: ${name}\nEmail: ${email}\nPhone: ${phone || 'Not provided'}\nSubject: ${subject || 'General message'}\n\n${message}`
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f1b18">
        <h2 style="margin: 0 0 12px">Gourishankar Mandir message</h2>
        <p style="margin: 0 0 8px"><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p style="margin: 0 0 8px"><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p style="margin: 0 0 8px"><strong>Phone:</strong> ${escapeHtml(phone || 'Not provided')}</p>
        <p style="margin: 0 0 8px"><strong>Subject:</strong> ${escapeHtml(subject || 'General message')}</p>
        <p style="white-space: pre-wrap; margin: 16px 0 0">${escapeHtml(message).replaceAll('\n', '<br />')}</p>
      </div>
    `

    const mailResult = await sendMail(env, {
      subject: finalSubject,
      text,
      html,
      replyTo: email,
    })

    sendJson(response, 200, {
      ok: true,
      message: 'Received.',
      emailed: mailResult.sent,
      mailStatus: mailResult.reason,
      mailError: mailResult.errorMessage || '',
      entry,
    })
    return true
  }

  return false
}

function createMiddleware(env) {
  return async (request, response, next) => {
    const pathname = new URL(request.url, 'http://localhost').pathname

    if (!pathname.startsWith('/api/')) {
      next()
      return
    }

    try {
      const handled = await handleSiteApi(request, response, pathname, env)
      if (!handled) next()
    } catch (error) {
      console.error(`API error for ${request.method} ${pathname}:`, error)
      sendJson(response, 500, { ok: false, message: 'Unable to complete the request.' })
    }
  }
}

export function createApiPlugin(env) {
  const middleware = createMiddleware(env)

  return {
    name: 'mongo-api',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
