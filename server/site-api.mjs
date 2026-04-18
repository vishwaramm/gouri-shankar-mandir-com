import nodemailer from 'nodemailer'
import { MongoClient } from 'mongodb'

const RECIPIENT_EMAIL = 'drgsm@hotmail.com'

let mongoClient
let mongoDbPromise

const memoryStore = {
  newsletters: [],
  serviceRequests: [],
  rsvps: [],
  contactMessages: [],
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
    mongoDbPromise = mongoClient.connect().then(async (client) => {
      const db = client.db(mongoDbName)

      await Promise.all([
        db.collection('newsletters').createIndex({ email: 1 }, { unique: true }),
        db.collection('serviceRequests').createIndex({ createdAt: -1 }),
        db.collection('rsvps').createIndex({ createdAt: -1 }),
        db.collection('contactMessages').createIndex({ createdAt: -1 }),
      ])

      return db
    })
  }

  return mongoDbPromise
}

async function listCollection(db, name) {
  return db.collection(name).find({}).sort({ createdAt: -1 }).limit(20).toArray()
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

async function sendMail(env, { subject, text, html, replyTo }) {
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
      to: RECIPIENT_EMAIL,
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
        service: item.service,
        name: item.name,
        email: item.email,
        date: item.date || '',
        note: item.note,
        createdAt: item.createdAt,
      })),
      rsvps: rsvps.map((item) => ({
        event: item.event,
        createdAt: item.createdAt,
      })),
      contactMessages: contactMessages.map((item) => ({
        name: item.name,
        email: item.email,
        subject: item.subject || '',
        message: item.message,
        createdAt: item.createdAt,
      })),
    })
    return true
  }

  if (request.method === 'DELETE' && pathname === '/api/site-data') {
    if (usingMongo) {
      await Promise.all([
        db.collection('newsletters').deleteMany({}),
        db.collection('serviceRequests').deleteMany({}),
        db.collection('rsvps').deleteMany({}),
        db.collection('contactMessages').deleteMany({}),
      ])
    } else {
      memoryStore.newsletters = []
      memoryStore.serviceRequests = []
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

  if (request.method === 'POST' && pathname === '/api/service-requests') {
    const body = await readJsonBody(request)
    const service = typeof body.service === 'string' ? body.service.trim() : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = normalizeEmail(body.email)
    const date = typeof body.date === 'string' ? body.date.trim() : ''
    const note = typeof body.note === 'string' ? body.note.trim() : ''

    if (!service || !name || !email || !note) {
      sendJson(response, 400, { ok: false, message: 'Service, name, email, and note are required.' })
      return true
    }

    const entry = {
      service,
      name,
      email,
      date,
      note,
      createdAt: new Date().toISOString(),
    }

    if (usingMongo) {
      await db.collection('serviceRequests').insertOne(entry)
    } else {
      memoryStore.serviceRequests.unshift(entry)
    }

    const subject = `Gourishankar Mandir service request: ${service}`
    const text = `Service: ${service}\nName: ${name}\nEmail: ${email}\nDate: ${date || 'Not selected'}\n\n${note}`
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f1b18">
        <h2 style="margin: 0 0 12px">Gourishankar Mandir service request</h2>
        <p style="margin: 0 0 8px"><strong>Service:</strong> ${escapeHtml(service)}</p>
        <p style="margin: 0 0 8px"><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p style="margin: 0 0 8px"><strong>Email:</strong> ${escapeHtml(email)}</p>
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
    const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
    const message = typeof body.message === 'string' ? body.message.trim() : ''

    if (!name || !email || !message) {
      sendJson(response, 400, { ok: false, message: 'Name, email, and message are required.' })
      return true
    }

    const entry = {
      name,
      email,
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
    const text = `Name: ${name}\nEmail: ${email}\nSubject: ${subject || 'General message'}\n\n${message}`
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f1b18">
        <h2 style="margin: 0 0 12px">Gourishankar Mandir message</h2>
        <p style="margin: 0 0 8px"><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p style="margin: 0 0 8px"><strong>Email:</strong> ${escapeHtml(email)}</p>
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
    } catch {
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
