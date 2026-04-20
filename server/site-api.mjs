import nodemailer from 'nodemailer'
import { MongoClient } from 'mongodb'
import { createHmac, createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'

const PRIMARY_ADMIN_EMAIL = 'vishwaramm@gmail.com'
const LEGACY_ADMIN_EMAIL = 'drgsm@hotmail.com'
const RECIPIENT_EMAIL = PRIMARY_ADMIN_EMAIL

let mongoClient
let mongoDbPromise

const memoryStore = {
  newsletters: [],
  users: [],
  userSessions: [],
  passwordResets: [],
  emailVerifications: [],
  orders: [],
  orderEvents: [],
  paymentLinks: [],
  rsvps: [],
  contactMessages: [],
  squareWebhookEvents: [],
  adminAccessRequests: [],
  adminUsers: [],
  adminSessions: [],
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

function getAdminRecipientEmails(env) {
  const configured = env.ADMIN_NOTIFICATION_EMAILS?.trim() || env.ADMIN_EMAIL_RECIPIENTS?.trim() || env.ADMIN_EMAIL?.trim()
  if (configured) {
    return [...new Set(configured.split(',').map((item) => normalizeEmail(item)).filter(Boolean))]
  }

  return String(env.NODE_ENV || '').trim().toLowerCase() === 'production'
    ? [PRIMARY_ADMIN_EMAIL, LEGACY_ADMIN_EMAIL]
    : [PRIMARY_ADMIN_EMAIL]
}

function readTextBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''

    request.on('data', (chunk) => {
      body += chunk
    })

    request.on('end', () => {
      resolve(body)
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
          db.collection('users').createIndex({ email: 1 }, { unique: true }),
          db.collection('users').createIndex({ createdAt: -1 }),
          db.collection('userSessions').createIndex({ sessionId: 1 }, { unique: true }),
          db.collection('userSessions').createIndex({ userId: 1 }),
          db.collection('userSessions').createIndex({ expiresAt: 1 }),
          db.collection('passwordResets').createIndex({ tokenHash: 1 }, { unique: true, sparse: true }),
          db.collection('passwordResets').createIndex({ userId: 1 }),
          db.collection('passwordResets').createIndex({ expiresAt: 1 }),
          db.collection('emailVerifications').createIndex({ tokenHash: 1 }, { unique: true, sparse: true }),
          db.collection('emailVerifications').createIndex({ userId: 1 }),
          db.collection('emailVerifications').createIndex({ expiresAt: 1 }),
          db.collection('orders').createIndex({ canonicalKey: 1 }, { unique: true }),
          db.collection('orders').createIndex({ orderCode: 1 }, { unique: true, sparse: true }),
          db.collection('orders').createIndex({ requestId: 1 }, { unique: true, sparse: true }),
          db.collection('orders').createIndex({ donationId: 1 }, { unique: true, sparse: true }),
          db.collection('orders').createIndex({ squarePaymentId: 1 }, { unique: true, sparse: true }),
          db.collection('orders').createIndex({ createdAt: -1 }),
          db.collection('orderEvents').createIndex({ eventId: 1 }, { unique: true }),
          db.collection('orderEvents').createIndex({ orderCode: 1 }),
          db.collection('orderEvents').createIndex({ eventType: 1 }),
          db.collection('orderEvents').createIndex({ createdAt: -1 }),
          db.collection('paymentLinks').createIndex({ tokenHash: 1 }, { unique: true }),
          db.collection('paymentLinks').createIndex({ createdAt: -1 }),
          db.collection('paymentLinks').createIndex({ expiresAt: 1 }),
          db.collection('rsvps').createIndex({ createdAt: -1 }),
          db.collection('contactMessages').createIndex({ createdAt: -1 }),
          db.collection('squareWebhookEvents').createIndex({ eventId: 1 }, { unique: true }),
          db.collection('adminAccessRequests').createIndex({ tokenHash: 1 }, { unique: true, sparse: true }),
          db.collection('adminAccessRequests').createIndex({ email: 1 }),
          db.collection('adminAccessRequests').createIndex({ status: 1 }),
          db.collection('adminAccessRequests').createIndex({ expiresAt: 1 }),
          db.collection('adminUsers').createIndex({ email: 1 }, { unique: true }),
          db.collection('adminSessions').createIndex({ sessionId: 1 }, { unique: true }),
          db.collection('adminSessions').createIndex({ adminUserId: 1 }),
          db.collection('adminSessions').createIndex({ expiresAt: 1 }),
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

function normalizeEventDetail(value) {
  if (!value) return ''
  if (typeof value === 'string') return value.trim()
  return String(value)
}

async function saveOrderEvent(db, entry) {
  if (db) {
    await db.collection('orderEvents').insertOne(entry)
  } else {
    memoryStore.orderEvents.unshift(entry)
  }
}

async function recordOrderEvent(db, order, eventType, details = {}, actor = {}) {
  if (!order) return null

  const entry = {
    eventId: randomUUID(),
    orderCode: order.orderCode || '',
    requestId: order.requestId || '',
    donationId: order.donationId || '',
    eventType,
    status: order.status || order.serviceStatus || '',
    actorType: actor.type || 'system',
    actorName: actor.name || '',
    actorEmail: actor.email || '',
    actorRole: actor.role || '',
    message: normalizeEventDetail(details.message),
    details: normalizeEventDetail(details.details),
    createdAt: details.createdAt || new Date().toISOString(),
  }

  await saveOrderEvent(db, entry)
  return entry
}

async function listOrderEventsForOrderCode(db, orderCode, limit = 8) {
  const normalizedOrderCode = String(orderCode || '').trim().toUpperCase()
  if (!normalizedOrderCode) return []

  if (db) {
    return db
      .collection('orderEvents')
      .find({ orderCode: normalizedOrderCode })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()
  }

  return memoryStore.orderEvents
    .filter((item) => item.orderCode === normalizedOrderCode)
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
    .slice(0, limit)
}

async function listRecentOrderEvents(db, limit = 20) {
  if (db) {
    return db.collection('orderEvents').find({}).sort({ createdAt: -1 }).limit(limit).toArray()
  }

  return [...memoryStore.orderEvents].slice(0, limit)
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

function getUsersCollection(db) {
  return db.collection('users')
}

function getUserSessionsCollection(db) {
  return db.collection('userSessions')
}

function getPasswordResetsCollection(db) {
  return db.collection('passwordResets')
}

function getEmailVerificationsCollection(db) {
  return db.collection('emailVerifications')
}

function getOrdersCollection(db) {
  return db.collection('orders')
}

function getAdminUsersCollection(db) {
  return db.collection('adminUsers')
}

function getAdminSessionsCollection(db) {
  return db.collection('adminSessions')
}

function getAdminAccessRequestsCollection(db) {
  return db.collection('adminAccessRequests')
}

function hashSecret(value) {
  return createHash('sha256').update(String(value)).digest('hex')
}

function hashPassword(password) {
  const salt = randomBytes(16)
  const derivedKey = scryptSync(String(password), salt, 64)
  return `scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`
}

function verifyPassword(password, storedHash = '') {
  const [algorithm, saltHex, keyHex] = String(storedHash).split('$')
  if (algorithm !== 'scrypt' || !saltHex || !keyHex) return false

  try {
    const derivedKey = scryptSync(String(password), Buffer.from(saltHex, 'hex'), Buffer.from(keyHex, 'hex').length)
    const expected = Buffer.from(keyHex, 'hex')
    if (derivedKey.length !== expected.length) return false
    return timingSafeEqual(derivedKey, expected)
  } catch {
    return false
  }
}

function generateSecret(lengthBytes = 32) {
  return randomBytes(lengthBytes).toString('base64url')
}

function buildRedirect(response, location, statusCode = 302) {
  response.statusCode = statusCode
  response.setHeader('Location', location)
  response.end()
}

function generateOrderCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(6)
  let code = 'GM-'

  for (const byte of bytes) {
    code += alphabet[byte % alphabet.length]
  }

  return code
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

function isStrictPersistenceEnabled(env) {
  const flag = String(
    env.STRICT_PERSISTENCE || env.REQUIRE_MONGODB_STORAGE || env.REQUIRE_DB_STORAGE || '',
  )
    .trim()
    .toLowerCase()

  if (['1', 'true', 'yes', 'on'].includes(flag)) return true
  return String(env.NODE_ENV || '').trim().toLowerCase() === 'production'
}

function getPublicRuntimeConfig(env) {
  const siteUrl = getConfiguredOrigin(env)
  const squareEnvironment = env.VITE_SQUARE_ENVIRONMENT?.trim().toLowerCase() || ''

  return {
    siteUrl,
    square: {
      appId: env.VITE_SQUARE_APP_ID?.trim() || '',
      locationId: env.VITE_SQUARE_LOCATION_ID?.trim() || '',
      environment: squareEnvironment,
      configured: Boolean(env.VITE_SQUARE_APP_ID?.trim() && env.VITE_SQUARE_LOCATION_ID?.trim()),
    },
  }
}

function isSameOriginRequest(request, env) {
  const requestOrigin = request.headers.origin?.trim()
  if (!requestOrigin) return true

  const expectedOrigin = getConfiguredOrigin(env) || getRequestOrigin(request, env)
  return requestOrigin.replace(/\/$/, '') === expectedOrigin
}

function getSessionCookieOptions(request, env, maxAgeSeconds = 60 * 60 * 24 * 7) {
  return {
    path: '/',
    maxAge: maxAgeSeconds,
    sameSite: 'Strict',
    secure: getRequestProtocol(request, env) === 'https',
  }
}

async function getPriestAuthState(db) {
  const adminCount = db
    ? await getAdminUsersCollection(db).countDocuments({})
    : memoryStore.adminUsers.length
  return {
    configured: adminCount > 0,
    adminCount,
  }
}

async function createPriestAdminSession(db, adminUserId) {
  const sessionId = generateSecret(32)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
  const entry = {
    sessionId,
    adminUserId,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
  }

  if (db) {
    await getAdminSessionsCollection(db).insertOne(entry)
  } else {
    memoryStore.adminSessions.unshift(entry)
  }

  return entry
}

async function getPriestSession(db, sessionId) {
  if (!sessionId) return null

  if (db) {
    const session = await getAdminSessionsCollection(db).findOne({ sessionId })
    if (!session) return null
    if (new Date(session.expiresAt).getTime() <= Date.now()) return null
    return session
  }

  const session = memoryStore.adminSessions.find((item) => item.sessionId === sessionId)
  if (!session) return null
  if (new Date(session.expiresAt).getTime() <= Date.now()) return null
  return session
}

function serializeAdminUser(adminUser) {
  if (!adminUser) return null
  return {
    id: adminUser.id || '',
    name: adminUser.name || '',
    email: adminUser.email || '',
    role: adminUser.role || 'staff',
    createdAt: adminUser.createdAt || '',
    updatedAt: adminUser.updatedAt || '',
    lastLoginAt: adminUser.lastLoginAt || '',
  }
}

function getAdminRole(adminUser) {
  return adminUser?.role === 'owner' ? 'owner' : 'staff'
}

function getAdminPermissions(adminUser) {
  const role = getAdminRole(adminUser)
  return {
    role,
    canViewAdminAccessRequests: role === 'owner',
    canViewSquareSync: role === 'owner',
    canResetSiteData: role === 'owner',
  }
}

async function getAdminUserByEmail(db, email) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return null

  if (db) {
    return getAdminUsersCollection(db).findOne({ email: normalizedEmail })
  }

  return memoryStore.adminUsers.find((item) => item.email === normalizedEmail) || null
}

async function getAdminUserById(db, adminUserId) {
  if (!adminUserId) return null

  if (db) {
    return getAdminUsersCollection(db).findOne({ id: adminUserId })
  }

  return memoryStore.adminUsers.find((item) => item.id === adminUserId) || null
}

async function createAdminUserSession(db, adminUserId) {
  return createPriestAdminSession(db, adminUserId)
}

async function getUserByEmail(db, email) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return null

  if (db) {
    return getUsersCollection(db).findOne({ email: normalizedEmail })
  }

  return memoryStore.users.find((item) => item.email === normalizedEmail) || null
}

async function getUserById(db, userId) {
  if (!userId) return null

  if (db) {
    return getUsersCollection(db).findOne({ id: userId })
  }

  return memoryStore.users.find((item) => item.id === userId) || null
}

async function createUserSession(db, userId) {
  const sessionId = generateSecret(32)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
  const entry = {
    sessionId,
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
  }

  if (db) {
    await getUserSessionsCollection(db).insertOne(entry)
  } else {
    memoryStore.userSessions.unshift(entry)
  }

  return entry
}

async function getUserSession(db, sessionId) {
  if (!sessionId) return null

  if (db) {
    const session = await getUserSessionsCollection(db).findOne({ sessionId })
    if (!session) return null
    if (new Date(session.expiresAt).getTime() <= Date.now()) return null
    return session
  }

  const session = memoryStore.userSessions.find((item) => item.sessionId === sessionId)
  if (!session) return null
  if (new Date(session.expiresAt).getTime() <= Date.now()) return null
  return session
}

async function getAuthenticatedUser(db, request) {
  const sessionId = getCookie(request, 'mandir_user_session')
  const session = await getUserSession(db, sessionId)
  if (!session) return null
  return getUserById(db, session.userId)
}

async function attachOrdersToUser(db, user) {
  if (!user?.id || !user.email) return

  if (db) {
    await db.collection('orders').updateMany(
      {
        email: user.email,
        $or: [{ userId: { $exists: false } }, { userId: '' }, { userId: null }],
      },
      { $set: { userId: user.id } },
    )
    return
  }

  memoryStore.orders = memoryStore.orders.map((item) =>
    item.email === user.email ? { ...item, userId: item.userId || user.id } : item,
  )
}

function normalizeNotificationPrefs(input = {}, fallback = {}) {
  const serviceEmails = input.serviceEmails !== undefined ? Boolean(input.serviceEmails) : fallback.serviceEmails !== false
  const templeLetters = input.templeLetters !== undefined ? Boolean(input.templeLetters) : Boolean(fallback.templeLetters)

  return {
    serviceEmails,
    templeLetters,
  }
}

function shouldSendServiceEmails(user) {
  if (!user) return true
  return user.notificationPrefs?.serviceEmails !== false
}

function normalizePassword(password) {
  return typeof password === 'string' ? password.trim() : ''
}

function buildPasswordResetUrl(env, request, token) {
  const url = new URL('/account/reset-password', getPublicSiteOrigin(env, request))
  url.searchParams.set('token', token)
  return url.toString()
}

async function createPasswordReset(db, userId) {
  const token = generateSecret(32)
  const tokenHash = hashSecret(token)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString()
  const entry = {
    id: randomUUID(),
    userId,
    tokenHash,
    createdAt: new Date().toISOString(),
    expiresAt,
    usedAt: '',
  }

  if (db) {
    await getPasswordResetsCollection(db).insertOne(entry)
  } else {
    memoryStore.passwordResets.unshift(entry)
  }

  return { token, entry }
}

async function getPasswordResetByToken(db, token) {
  const tokenHash = hashSecret(token)
  if (db) {
    const entry = await getPasswordResetsCollection(db).findOne({ tokenHash })
    if (!entry) return null
    if (entry.usedAt) return null
    if (new Date(entry.expiresAt).getTime() <= Date.now()) return null
    return entry
  }

  const entry = memoryStore.passwordResets.find((item) => item.tokenHash === tokenHash) || null
  if (!entry) return null
  if (entry.usedAt) return null
  if (new Date(entry.expiresAt).getTime() <= Date.now()) return null
  return entry
}

async function markPasswordResetUsed(db, resetId, userId) {
  const usedAt = new Date().toISOString()
  if (db) {
    await getPasswordResetsCollection(db).updateOne(
      { id: resetId },
      { $set: { usedAt, userId } },
    )
  } else {
    memoryStore.passwordResets = memoryStore.passwordResets.map((item) =>
      item.id === resetId ? { ...item, usedAt, userId } : item,
    )
  }
}

async function clearUserSessions(db, userId) {
  if (db) {
    await getUserSessionsCollection(db).deleteMany({ userId })
    return
  }

  memoryStore.userSessions = memoryStore.userSessions.filter((item) => item.userId !== userId)
}

async function clearOtherUserSessions(db, userId, keepSessionId = '') {
  if (db) {
    await getUserSessionsCollection(db).deleteMany({
      userId,
      ...(keepSessionId ? { sessionId: { $ne: keepSessionId } } : {}),
    })
    return
  }

  memoryStore.userSessions = memoryStore.userSessions.filter(
    (item) => item.userId !== userId || (keepSessionId && item.sessionId === keepSessionId),
  )
}

async function clearUserEmailVerifications(db, userId) {
  if (db) {
    await getEmailVerificationsCollection(db).deleteMany({ userId, usedAt: '' })
    return
  }

  memoryStore.emailVerifications = memoryStore.emailVerifications.filter(
    (item) => item.userId !== userId || item.usedAt,
  )
}

async function createAdminAccessRequest(db, requestData) {
  const token = generateSecret(32)
  const tokenHash = hashSecret(token)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString()
  const entry = {
    id: randomUUID(),
    name: requestData.name,
    email: requestData.email,
    passwordHash: requestData.passwordHash,
    tokenHash,
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt,
    approvedAt: '',
    approvedAdminUserId: '',
    emailedAt: '',
  }

  if (db) {
    await getAdminAccessRequestsCollection(db).insertOne(entry)
  } else {
    memoryStore.adminAccessRequests.unshift(entry)
  }

  return { token, entry }
}

async function getAdminAccessRequestByToken(db, token) {
  const tokenHash = hashSecret(token)
  if (db) {
    const entry = await getAdminAccessRequestsCollection(db).findOne({ tokenHash })
    if (!entry) return null
    if (entry.status === 'approved') return entry
    if (new Date(entry.expiresAt).getTime() <= Date.now()) return null
    return entry
  }

  const entry = memoryStore.adminAccessRequests.find((item) => item.tokenHash === tokenHash) || null
  if (!entry) return null
  if (entry.status === 'approved') return entry
  if (new Date(entry.expiresAt).getTime() <= Date.now()) return null
  return entry
}

async function getPendingAdminAccessRequestByEmail(db, email) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return null

  if (db) {
    return getAdminAccessRequestsCollection(db).findOne({
      email: normalizedEmail,
      status: 'pending',
      expiresAt: { $gt: new Date().toISOString() },
    })
  }

  return (
    memoryStore.adminAccessRequests.find(
      (item) =>
        item.email === normalizedEmail &&
        item.status === 'pending' &&
        new Date(item.expiresAt).getTime() > Date.now(),
    ) || null
  )
}

async function markAdminAccessRequestApproved(db, requestId, adminUserId) {
  const approvedAt = new Date().toISOString()
  if (db) {
    await getAdminAccessRequestsCollection(db).updateOne(
      { id: requestId },
      { $set: { status: 'approved', approvedAt, approvedAdminUserId: adminUserId } },
    )
  } else {
    memoryStore.adminAccessRequests = memoryStore.adminAccessRequests.map((item) =>
      item.id === requestId
        ? { ...item, status: 'approved', approvedAt, approvedAdminUserId: adminUserId }
        : item,
    )
  }
  return approvedAt
}

function buildAdminAccessRequestApprovalUrl(env, request, token) {
  const url = new URL('/api/priest-auth/approve', getPublicSiteOrigin(env, request))
  url.searchParams.set('token', token)
  return url.toString()
}

function buildAdminAccessRequestEmail({ name, email, approvalUrl }) {
  return {
    subject: `Admin access request from ${name || email || 'applicant'}`,
    text: [
      `An admin access request was submitted.`,
      `Name: ${name || 'Not provided'}`,
      `Email: ${email || 'Not provided'}`,
      '',
      `Approve request: ${approvalUrl}`,
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f1b18">
        <h2 style="margin: 0 0 12px">Admin access request</h2>
        <p style="margin: 0 0 8px"><strong>Name:</strong> ${escapeHtml(name || 'Not provided')}</p>
        <p style="margin: 0 0 8px"><strong>Email:</strong> ${escapeHtml(email || 'Not provided')}</p>
        <p style="margin: 0 0 12px">
          Approve request:
          <a href="${escapeHtml(approvalUrl)}">${escapeHtml(approvalUrl)}</a>
        </p>
      </div>
    `,
  }
}

function buildAdminAccessApprovedEmail({ name }) {
  return {
    subject: 'Your admin access request was approved',
    text: [
      `Namaste ${name || 'devotee'},`,
      '',
      'Your admin access request was approved.',
      'You can now sign in to the admin page with the email and password you submitted.',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f1b18">
        <h2 style="margin: 0 0 12px">Admin access approved</h2>
        <p style="margin: 0 0 8px">Namaste ${escapeHtml(name || 'devotee')},</p>
        <p style="margin: 0">Your admin access request was approved. You can now sign in to the admin page with the email and password you submitted.</p>
      </div>
    `,
  }
}

function serializeUser(user) {
  if (!user) return null
  return {
    id: user.id || '',
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    notificationPrefs: {
      serviceEmails: user.notificationPrefs?.serviceEmails !== false,
      templeLetters: Boolean(user.notificationPrefs?.templeLetters),
    },
    emailVerifiedAt: user.emailVerifiedAt || '',
    verificationSentAt: user.verificationSentAt || '',
    createdAt: user.createdAt || '',
    updatedAt: user.updatedAt || '',
    lastLoginAt: user.lastLoginAt || '',
  }
}

function formatScheduleDate(value) {
  if (!value) return ''

  const text = String(value).trim()
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T12:00:00`)
    : new Date(text)
  if (Number.isNaN(date.getTime())) return text

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function normalizeOrderPair(request, donation, user) {
  const requestedAt = request?.createdAt || donation?.createdAt || ''
  const reviewedAt = request?.reviewedAt || ''
  const sentAt = request?.paymentPageSentAt || ''
  const paidAt = request?.paymentReceivedAt || donation?.paidAt || ''
  const scheduledFor = request?.scheduledFor || donation?.scheduledFor || ''
  const supportRequestedAt = request?.supportRequestedAt || donation?.supportRequestedAt || ''
  const supportRequestType = request?.supportRequestType || donation?.supportRequestType || ''
  const refundRequestedAt = request?.refundRequestedAt || donation?.refundRequestedAt || ''
  const refundedAt = request?.refundedAt || donation?.refundedAt || ''
  const cancelledAt = request?.cancelledAt || donation?.cancelledAt || ''
  const completedAt = request?.serviceCompletedAt || donation?.serviceCompletedAt || ''
  const requestId = request?.id || donation?.requestId || ''
  const donationId = donation?.id || request?.donationId || ''
  const status = request?.serviceStatus || donation?.serviceStatus || (paidAt ? 'awaiting_completion' : 'pending_review')

  return {
    requestedAt,
    reviewedAt,
    sentAt,
    paidAt,
    scheduledFor,
    supportRequestedAt,
    supportRequestType,
    refundRequestedAt,
    refundedAt,
    cancelledAt,
    completedAt,
    requestId,
    donationId,
    status,
    service: request?.service || donation?.service || 'Payment',
    amountCents: donation?.amountCents || request?.paymentPageAmountCents || 0,
    name: request?.name || donation?.donorName || user?.name || '',
    email: request?.email || donation?.donorEmail || user?.email || '',
    note: request?.note || '',
    completionNote: request?.completionNote || '',
    supportRequestReason: request?.supportRequestReason || donation?.supportRequestReason || '',
    refundStatus: request?.refundStatus || donation?.refundStatus || '',
    refundSquareRefundId: request?.refundSquareRefundId || donation?.refundSquareRefundId || '',
    createdAt: request?.createdAt || donation?.createdAt || '',
    paymentStatus: request?.paymentStatus || donation?.paymentStatus || '',
    serviceCompletionNotifiedAt: request?.serviceCompletionNotifiedAt || donation?.serviceCompletionNotifiedAt || '',
    orderCode: request?.orderCode || donation?.orderCode || '',
  }
}

function buildOrderTimeline(order) {
  const {
    requestedAt,
    reviewedAt,
    sentAt,
    paidAt,
    scheduledFor,
    supportRequestedAt,
    supportRequestType,
    refundRequestedAt,
    refundedAt,
    cancelledAt,
    completedAt,
  } = order

  return [
    requestedAt
      ? {
          key: 'requested',
          label: 'Requested',
          detail: 'The service request was submitted.',
          at: requestedAt,
        }
      : null,
    reviewedAt
      ? {
          key: 'reviewed',
          label: 'Reviewed',
          detail: 'The priest team reviewed the request and prepared the payment page.',
          at: reviewedAt,
        }
      : null,
    sentAt
      ? {
          key: 'payment_page_sent',
          label: 'Payment page sent',
          detail: 'The payment link was emailed to the donor.',
          at: sentAt,
        }
      : null,
    paidAt
      ? {
          key: 'paid',
          label: 'Payment received',
          detail: 'The payment was completed and recorded.',
          at: paidAt,
        }
      : null,
    scheduledFor
      ? {
          key: 'scheduled',
          label: 'Target completion',
          detail: `The service is scheduled for ${formatScheduleDate(scheduledFor)}.`,
          at: scheduledFor,
        }
      : null,
    supportRequestedAt
      ? {
          key: 'support_requested',
          label:
            supportRequestType === 'refund'
              ? 'Refund requested'
              : supportRequestType === 'cancel'
                ? 'Cancellation requested'
                : 'Support requested',
          detail:
            supportRequestType === 'refund'
              ? 'A refund review was requested for this order.'
              : supportRequestType === 'cancel'
                ? 'A cancellation review was requested for this order.'
                : 'A support request was submitted for this order.',
          at: supportRequestedAt,
        }
      : null,
    refundRequestedAt
      ? {
          key: 'refund_requested',
          label: 'Refund processing',
          detail: 'The refund request is being processed.',
          at: refundRequestedAt,
        }
      : null,
    completedAt
      ? {
          key: 'completed',
          label: 'Completed',
          detail: 'The priest team marked the service complete.',
          at: completedAt,
        }
      : null,
    refundedAt
      ? {
          key: 'refunded',
          label: 'Refunded',
          detail: 'The payment was refunded and recorded.',
          at: refundedAt,
        }
      : null,
    cancelledAt
      ? {
          key: 'cancelled',
          label: 'Cancelled',
          detail: 'The priest team marked the service cancelled.',
          at: cancelledAt,
        }
      : null,
  ].filter(Boolean)
}

function buildOrderSummaryRecord(request, donation, user) {
  const order = normalizeOrderPair(request, donation, user)
  const timeline = buildOrderTimeline(order)

  return {
    id: order.requestId || order.donationId || randomUUID(),
    type: order.requestId ? 'service' : 'donation',
    service: order.service,
    status: order.status,
    amountCents: order.amountCents,
    requestId: order.requestId,
    donationId: order.donationId,
    name: order.name,
    email: order.email,
    userId: request?.userId || donation?.userId || user?.id || '',
    note: order.note,
    completionNote: order.completionNote,
    supportRequestType: order.supportRequestType,
    supportRequestedAt: order.supportRequestedAt,
    supportRequestReason: order.supportRequestReason,
    refundRequestedAt: order.refundRequestedAt,
    refundedAt: order.refundedAt,
    cancelledAt: order.cancelledAt,
    refundStatus: order.refundStatus,
    refundSquareRefundId: order.refundSquareRefundId,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    completedAt: order.completedAt,
    scheduledFor: order.scheduledFor,
    paymentStatus: order.paymentStatus,
    serviceCompletedAt: order.completedAt,
    serviceCompletionNotifiedAt: order.serviceCompletionNotifiedAt,
    isInProgress: Boolean(
      order.requestId && order.status && !['completed', 'refunded', 'cancelled', 'cancel_requested', 'refund_requested'].includes(order.status),
    ),
    orderCode: order.orderCode,
    timeline,
    refundRequestedAt: order.refundRequestedAt,
    refundedAt: order.refundedAt,
    cancelledAt: order.cancelledAt,
  }
}

async function findOrderPairByOrderCode(db, orderCode) {
  const normalizedOrderCode = String(orderCode || '').trim().toUpperCase()
  if (!normalizedOrderCode) return { order: null, normalizedOrderCode }

  const order = db
    ? await getOrdersCollection(db).findOne({ orderCode: normalizedOrderCode })
    : memoryStore.orders.find((item) => item.orderCode === normalizedOrderCode) || null

  return { order, normalizedOrderCode }
}

async function findOrderPairByPaymentId(db, paymentId) {
  const normalizedPaymentId = String(paymentId || '').trim()
  if (!normalizedPaymentId) return { order: null, normalizedPaymentId }

  const order = db
    ? await getOrdersCollection(db).findOne({ squarePaymentId: normalizedPaymentId })
    : memoryStore.orders.find((item) => item.squarePaymentId === normalizedPaymentId) || null

  return { order, normalizedPaymentId }
}

async function listUserOrders(db, user) {
  if (!user) return []

  const email = normalizeEmail(user.email)
  if (db) {
    return getOrdersCollection(db)
      .find({ $or: [{ userId: user.id }, { email }] })
      .sort({ createdAt: -1 })
      .toArray()
  }

  return memoryStore.orders
    .filter((item) => item.userId === user.id || item.email === email)
    .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())
}

async function lookupPublicOrder(db, orderCode, email = '') {
  const normalizedOrderCode = String(orderCode || '').trim().toUpperCase()
  const normalizedEmail = normalizeEmail(email)
  const { order } = await findOrderPairByOrderCode(db, normalizedOrderCode)
  const fallbackEmail = order?.email || ''
  if (normalizedEmail && normalizeEmail(fallbackEmail) !== normalizedEmail) {
    return null
  }

  if (!order) return null

  const activity = await listOrderEventsForOrderCode(db, normalizedOrderCode, 8)

  return {
    ...order,
    activity: activity.map((item) => ({
      ...item,
    })),
    lookupEmail: normalizedEmail || fallbackEmail,
    trackUrl: normalizedOrderCode
      ? `/track-order?code=${encodeURIComponent(normalizedOrderCode)}${normalizedEmail ? `&email=${encodeURIComponent(normalizedEmail)}` : ''}`
      : '',
  }
}

async function findOrderPairByRequestId(db, requestId) {
  if (!requestId) return { request: null, donation: null }

  const order = db
    ? await getOrdersCollection(db).findOne({ requestId })
    : memoryStore.orders.find((item) => item.requestId === requestId) || null

  return { request: order, donation: null }
}

async function updateOrderPair(db, request, donation, requestUpdate, donationUpdate = requestUpdate) {
  if (!request && !donation) return

  if (request) {
    Object.assign(request, requestUpdate)
  }

  if (donation) {
    Object.assign(donation, donationUpdate)
  }

  await upsertCanonicalOrder(db, request, donation, request || donation || null)
}

async function saveSupportRequest(db, request, donation, update) {
  await updateOrderPair(db, request, donation, update)
}

async function upsertCanonicalOrder(db, request, donation, user) {
  const order = buildOrderSummaryRecord(request, donation, user || request || donation || null)
  const canonicalKey = order.requestId || order.donationId || order.orderCode || order.id

  if (db) {
    await getOrdersCollection(db).updateOne(
      { canonicalKey },
      {
        $set: {
          ...order,
          canonicalKey,
        },
      },
      { upsert: true },
    )
  } else {
    const entry = {
      ...order,
      canonicalKey,
    }
    const index = memoryStore.orders.findIndex((item) => item.canonicalKey === canonicalKey)
    if (index >= 0) {
      memoryStore.orders[index] = entry
    } else {
      memoryStore.orders.unshift(entry)
    }
  }

  return { ...order, canonicalKey }
}

function getSquareWebhookNotificationUrl(env, request, pathname) {
  const configured = env.SQUARE_WEBHOOK_URL?.trim() || env.SQUARE_NOTIFICATION_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  return new URL(pathname, getPublicSiteOrigin(env, request)).toString()
}

function verifySquareWebhookSignature(request, env, rawBody, pathname) {
  const signatureKey = env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim() || env.SQUARE_WEBHOOK_SIGNATURE?.trim()
  if (!signatureKey) return { ok: true, reason: 'missing_signature_key' }

  const signature = request.headers['x-square-hmacsha256-signature']?.trim() || request.headers['x-square-signature']?.trim() || ''
  if (!signature) {
    return { ok: false, reason: 'missing_signature' }
  }

  const notificationUrl = getSquareWebhookNotificationUrl(env, request, pathname)
  const expected = createHmac('sha256', signatureKey).update(notificationUrl).update(rawBody).digest('base64')
  const received = Buffer.from(signature)
  const actual = Buffer.from(expected)

  if (received.length !== actual.length) {
    return { ok: false, reason: 'invalid_signature' }
  }

  try {
    return { ok: timingSafeEqual(received, actual), reason: 'invalid_signature' }
  } catch {
    return { ok: false, reason: 'invalid_signature' }
  }
}

async function saveSquareWebhookEvent(db, entry) {
  if (db) {
    await db.collection('squareWebhookEvents').insertOne(entry)
  } else {
    memoryStore.squareWebhookEvents.unshift(entry)
  }
}

async function getSquareSyncStatus(db, env) {
  const webhookConfigured = Boolean((env.SQUARE_WEBHOOK_URL?.trim() || env.SQUARE_NOTIFICATION_URL?.trim()) && (env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim() || env.SQUARE_WEBHOOK_SIGNATURE?.trim()))
  const signatureConfigured = Boolean(env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim() || env.SQUARE_WEBHOOK_SIGNATURE?.trim())
  const webhookUrl = env.SQUARE_WEBHOOK_URL?.trim() || env.SQUARE_NOTIFICATION_URL?.trim() || ''
  const events = db
    ? await db.collection('squareWebhookEvents').find({}).sort({ createdAt: -1 }).limit(20).toArray()
    : [...memoryStore.squareWebhookEvents].slice(0, 20)

  return {
    webhookConfigured,
    signatureConfigured,
    webhookUrl,
    recentEvents: events.length,
    lastEventAt: events[0]?.createdAt || '',
    lastEventType: events[0]?.eventType || '',
  }
}

async function hasProcessedSquareWebhookEvent(db, eventId) {
  if (!eventId) return false
  if (db) {
    const existing = await db.collection('squareWebhookEvents').findOne({ eventId })
    return Boolean(existing)
  }
  return memoryStore.squareWebhookEvents.some((item) => item.eventId === eventId)
}

async function getSquareApiJson(env, path) {
  const accessToken = env.SQUARE_ACCESS_TOKEN?.trim()
  if (!accessToken) return null

  const response = await fetch(`${getSquareBaseUrl(env)}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Square-Version': env.SQUARE_VERSION || '2026-01-22',
    },
  })

  if (!response.ok) return null
  return response.json()
}

async function getSquarePayment(env, paymentId) {
  if (!paymentId) return null
  const result = await getSquareApiJson(env, `/v2/payments/${encodeURIComponent(paymentId)}`)
  return result?.payment || null
}

async function getSquareRefund(env, refundId) {
  if (!refundId) return null
  const result = await getSquareApiJson(env, `/v2/refunds/${encodeURIComponent(refundId)}`)
  return result?.refund || null
}

async function reconcileSquareOrderState(db, env, order) {
  const paymentId = order?.squarePaymentId || ''
  if (!paymentId) return { request: order, donation: null, changed: false }

  const payment = await getSquarePayment(env, paymentId)
  if (!payment) return { request: order, donation: null, changed: false }

  const updates = {}
  const status = String(payment.status || '').toUpperCase()
  const refundedMoney = Number(payment.refunded_money?.amount || 0)
  const totalMoney = Number(payment.amount_money?.amount || 0)
  const refundIds = Array.isArray(payment.refund_ids) ? payment.refund_ids : []
  const hasRefund = refundedMoney > 0 || refundIds.length > 0

  if (status === 'CANCELED') {
    updates.serviceStatus = 'cancelled'
    updates.cancelledAt = order?.cancelledAt || payment.updated_at || new Date().toISOString()
    updates.supportRequestType = 'cancel'
    updates.supportRequestedAt = order?.supportRequestedAt || updates.cancelledAt
  } else if (hasRefund && refundedMoney >= totalMoney && totalMoney > 0) {
    updates.serviceStatus = 'refunded'
    updates.refundedAt = order?.refundedAt || payment.updated_at || new Date().toISOString()
    updates.refundStatus = 'COMPLETED'
    updates.refundRequestedAt = order?.refundRequestedAt || updates.refundedAt
    updates.supportRequestType = 'refund'
    updates.supportRequestedAt = order?.supportRequestedAt || updates.refundedAt
  } else if (hasRefund) {
    updates.serviceStatus = order?.serviceStatus || 'awaiting_completion'
    updates.refundStatus = payment.refunded_money?.amount ? 'PARTIALLY_REFUNDED' : (order?.refundStatus || '')
    updates.refundRequestedAt = order?.refundRequestedAt || payment.updated_at || new Date().toISOString()
    updates.supportRequestType = 'refund'
    updates.supportRequestedAt = order?.supportRequestedAt || updates.refundRequestedAt
  } else if (status === 'COMPLETED' && !order?.paymentReceivedAt && !order?.paidAt) {
    updates.serviceStatus = 'awaiting_completion'
    updates.paymentReceivedAt = payment.updated_at || new Date().toISOString()
    updates.paymentStatus = 'paid'
  }

  const paymentRefunds = []
  for (const refundId of refundIds) {
    const refund = await getSquareRefund(env, refundId)
    if (refund) paymentRefunds.push(refund)
  }

  if (paymentRefunds.length && !updates.refundedAt) {
    const completedRefund = paymentRefunds.find((item) => String(item.status || '').toUpperCase() === 'COMPLETED')
    if (completedRefund && !updates.refundStatus) {
      updates.refundStatus = completedRefund.status
    }
  }

  if (!Object.keys(updates).length) {
    return { request: order, donation: null, changed: false }
  }

  Object.assign(order, updates)
  await upsertCanonicalOrder(db, order, null, order)
  return { request: { ...order, ...updates }, donation: null, changed: true }
}

async function syncSquareLinkedOrders(db, env, { requestId = '', orderCode = '' } = {}) {
  const matchedOrders = []

  if (requestId) {
    const order = db
      ? await getOrdersCollection(db).findOne({ requestId })
      : memoryStore.orders.find((item) => item.requestId === requestId) || null
    if (order) matchedOrders.push(order)
  } else if (orderCode) {
    const { order } = await findOrderPairByOrderCode(db, orderCode)
    if (order) matchedOrders.push(order)
  } else if (db) {
    matchedOrders.push(...(await getOrdersCollection(db).find({ squarePaymentId: { $ne: '' } }).toArray()))
  } else {
    matchedOrders.push(...memoryStore.orders.filter((item) => item.squarePaymentId))
  }

  const uniq = new Map()
  for (const order of matchedOrders) {
    if (!order?.squarePaymentId) continue
    uniq.set(order.squarePaymentId, order)
  }

  const results = []
  for (const order of uniq.values()) {
    const result = await reconcileSquareOrderState(db, env, order)
    results.push({
      paymentId: order.squarePaymentId,
      requestId: order.requestId || '',
      changed: Boolean(result.changed),
    })
  }

  return {
    syncedCount: results.length,
    changedCount: results.filter((item) => item.changed).length,
    results,
  }
}

function isValidPassword(password) {
  return typeof password === 'string' && password.trim().length >= 8
}

async function loadUserForRequest(db, request) {
  const user = await getAuthenticatedUser(db, request)
  return user ? serializeUser(user) : null
}

async function requireUserAuth(db, request, response) {
  const user = await getAuthenticatedUser(db, request)
  if (!user) {
    sendJson(response, 401, { ok: false, message: 'Unauthorized.' })
    return null
  }

  return user
}

async function createEmailVerification(db, userId) {
  const token = generateSecret(32)
  const tokenHash = hashSecret(token)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString()
  const entry = {
    id: randomUUID(),
    userId,
    tokenHash,
    createdAt: new Date().toISOString(),
    expiresAt,
    usedAt: '',
  }

  if (db) {
    await getEmailVerificationsCollection(db).insertOne(entry)
  } else {
    memoryStore.emailVerifications.unshift(entry)
  }

  return { token, entry }
}

async function getEmailVerificationByToken(db, token) {
  const tokenHash = hashSecret(token)
  if (db) {
    const entry = await getEmailVerificationsCollection(db).findOne({ tokenHash })
    if (!entry) return null
    if (entry.usedAt) return null
    if (new Date(entry.expiresAt).getTime() <= Date.now()) return null
    return entry
  }

  const entry = memoryStore.emailVerifications.find((item) => item.tokenHash === tokenHash) || null
  if (!entry) return null
  if (entry.usedAt) return null
  if (new Date(entry.expiresAt).getTime() <= Date.now()) return null
  return entry
}

async function markEmailVerificationUsed(db, verificationId, userId) {
  const usedAt = new Date().toISOString()
  if (db) {
    await getEmailVerificationsCollection(db).updateOne(
      { id: verificationId },
      { $set: { usedAt, userId } },
    )
  } else {
    memoryStore.emailVerifications = memoryStore.emailVerifications.map((item) =>
      item.id === verificationId ? { ...item, usedAt, userId } : item,
    )
  }
}

function buildVerificationUrl(env, request, token) {
  const url = new URL('/account/verify-email', getPublicSiteOrigin(env, request))
  url.searchParams.set('token', token)
  return url.toString()
}

function buildOrderLookupUrl(env, request, orderCode, email = '') {
  const url = new URL('/track-order', getPublicSiteOrigin(env, request))
  url.searchParams.set('code', orderCode)
  if (email) url.searchParams.set('email', email)
  return url.toString()
}

function buildVerificationEmail({ name, verificationUrl }) {
  return {
    subject: 'Verify your Gourishankar Mandir account',
    text: [
      `Namaste ${name || 'devotee'},`,
      '',
      'Please verify your email address:',
      verificationUrl,
      '',
      'This link expires in 24 hours.',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f1b18">
        <h2 style="margin: 0 0 12px">Verify your email</h2>
        <p style="margin: 0 0 8px">Namaste ${escapeHtml(name || 'devotee')},</p>
        <p style="margin: 0 0 12px">
          Please verify your email address:
          <a href="${escapeHtml(verificationUrl)}">${escapeHtml(verificationUrl)}</a>
        </p>
        <p style="margin: 0">This link expires in 24 hours.</p>
      </div>
    `,
  }
}

async function sendVerificationEmail(env, request, user, token) {
  const verificationUrl = buildVerificationUrl(env, request, token)
  const mail = buildVerificationEmail({ name: user?.name || 'devotee', verificationUrl })
  return sendMail(env, {
    to: user.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    replyTo: RECIPIENT_EMAIL,
  })
}

async function isPriestAuthenticated(db, request) {
  const sessionId = getCookie(request, 'priest_review_session')
  return getPriestSession(db, sessionId)
}

async function getAuthenticatedPriestUser(db, request) {
  const session = await isPriestAuthenticated(db, request)
  if (!session?.adminUserId) return null
  return getAdminUserById(db, session.adminUserId)
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

function requireWebhookSecret(request, env) {
  const configured = env.MANDIR_WEBHOOK_SECRET?.trim()
  if (!configured) return true

  const headerSecret = request.headers['x-mandir-webhook-secret']?.trim() || ''
  const authorization = request.headers.authorization?.trim() || ''
  const bearerSecret = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : ''
  return headerSecret === configured || bearerSecret === configured
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
    scheduledFor: payload.scheduledFor || '',
    orderCode: payload.orderCode || generateOrderCode(),
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

async function createPublicPaymentLink(env, request, payload, db) {
  const amountCents = Number(payload.amountCents)
  const service = typeof payload.service === 'string' ? payload.service.trim() : ''

  if (!service || !Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, reason: 'invalid_payment_link' }
  }

  const link = await buildSecurePaymentPageUrl(
    env,
    request,
    {
      type: 'public-service',
      service,
      amountCents,
      note: typeof payload.note === 'string' ? payload.note.trim() : '',
    },
    db,
  )

  return {
    ok: true,
    url: link.url,
    token: link.token,
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

async function createSquareRefund(env, { paymentId, amountCents, reason }) {
  const accessToken = env.SQUARE_ACCESS_TOKEN?.trim()
  const locationId = env.SQUARE_LOCATION_ID?.trim()

  if (!accessToken) {
    return { ok: false, reason: 'missing_square_config' }
  }

  if (!paymentId?.trim()) {
    return { ok: false, reason: 'missing_payment' }
  }

  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, reason: 'invalid_amount' }
  }

  const body = {
    idempotency_key: randomUUID(),
    payment_id: paymentId.trim(),
    amount_money: {
      amount: amountCents,
      currency: 'USD',
    },
    reason: reason || 'Service refund',
  }

  if (locationId) {
    body.location_id = locationId
  }

  const response = await fetch(`${getSquareBaseUrl(env)}/v2/refunds`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Square-Version': env.SQUARE_VERSION || '2026-01-22',
    },
    body: JSON.stringify(body),
  })

  const text = await response.text()
  let data = {}

  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { errors: [{ detail: text || 'Square returned an invalid response.' }] }
  }

  if (!response.ok) {
    const squareError = data?.errors?.[0]?.detail || data?.message || 'Unable to create Square refund.'
    return { ok: false, reason: 'square_error', message: squareError }
  }

  return {
    ok: true,
    refund: data.refund || {},
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

function formatUsd(amountCents) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return '$0'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amountCents / 100)
}

function buildPaymentNextSteps({ isServiceRequest, scheduledFor = '' }) {
  const scheduleStep = scheduledFor
    ? `The priest team plans to complete the service on ${formatScheduleDate(scheduledFor)}.`
    : 'The priest team will complete the service and any required follow-up.'

  return isServiceRequest
    ? [
        'We recorded your payment and linked it to your service request.',
        scheduleStep,
        'You will receive a second email when the service is marked complete.',
      ]
    : [
        'We recorded your payment.',
        'Our team will review your note and follow up if anything else is needed.',
        'You will receive a confirmation email with the receipt and next steps.',
      ]
}

function buildPaymentConfirmationText({
  name,
  service,
  amountCents,
  orderCode = '',
  scheduledFor = '',
  trackUrl = '',
  nextSteps,
}) {
  return [
    `Namaste ${name || 'devotee'},`,
    '',
    `We received your payment of ${formatUsd(amountCents)} for ${service || 'your selected service'}.`,
    orderCode ? `Order code: ${orderCode}` : '',
    scheduledFor ? `Target completion: ${scheduledFor}` : '',
    trackUrl ? `Track it here: ${trackUrl}` : '',
    '',
    'What happens next:',
    ...nextSteps.map((step) => `- ${step}`),
    '',
    'If you need to update your request details, reply to this email.',
  ]
    .filter(Boolean)
    .join('\n')
}

function buildPaymentConfirmationHtml({
  name,
  service,
  amountCents,
  orderCode = '',
  scheduledFor = '',
  trackUrl = '',
  nextSteps,
}) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f1b18">
      <h2 style="margin: 0 0 12px">Your payment was received</h2>
      <p style="margin: 0 0 8px">Namaste ${escapeHtml(name || 'devotee')},</p>
      <p style="margin: 0 0 12px">
        We received your payment of <strong>${escapeHtml(formatUsd(amountCents))}</strong>
        for <strong>${escapeHtml(service || 'your selected service')}</strong>.
      </p>
      ${orderCode ? `<p style="margin: 0 0 8px"><strong>Order code:</strong> ${escapeHtml(orderCode)}</p>` : ''}
      ${scheduledFor ? `<p style="margin: 0 0 8px"><strong>Target completion:</strong> ${escapeHtml(scheduledFor)}</p>` : ''}
      ${trackUrl ? `<p style="margin: 0 0 12px"><strong>Track it here:</strong> <a href="${escapeHtml(trackUrl)}">${escapeHtml(trackUrl)}</a></p>` : ''}
      <p style="margin: 0 0 8px"><strong>What happens next:</strong></p>
      <ol style="margin: 0 0 12px 20px; padding: 0">
        ${nextSteps
          .map((step) => `<li style="margin: 0 0 6px">${escapeHtml(step)}</li>`)
          .join('')}
      </ol>
      <p style="margin: 0">If you need to update your request details, reply to this email.</p>
    </div>
  `
}

function buildCompletionText({ name, service, amountCents, orderCode = '', completionNote }) {
  return [
    `Namaste ${name || 'devotee'},`,
    '',
    `${service || 'Your service'} has been completed.`,
    `Payment recorded: ${formatUsd(amountCents)}.`,
    orderCode ? `Order code: ${orderCode}` : '',
    '',
    completionNote ? `Priest note: ${completionNote}` : '',
    '',
    'Thank you for allowing us to serve you.',
  ]
    .filter(Boolean)
    .join('\n')
}

function buildCompletionHtml({ name, service, amountCents, orderCode = '', completionNote }) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f1b18">
      <h2 style="margin: 0 0 12px">Your service is complete</h2>
      <p style="margin: 0 0 8px">Namaste ${escapeHtml(name || 'devotee')},</p>
      <p style="margin: 0 0 8px">${escapeHtml(service || 'Your service')} has been completed.</p>
      <p style="margin: 0 0 12px">Payment recorded: <strong>${escapeHtml(formatUsd(amountCents))}</strong>.</p>
      ${orderCode ? `<p style="margin: 0 0 12px"><strong>Order code:</strong> ${escapeHtml(orderCode)}</p>` : ''}
      ${completionNote ? `<p style="margin: 0 0 12px"><strong>Priest note:</strong> ${escapeHtml(completionNote)}</p>` : ''}
      <p style="margin: 0">Thank you for allowing us to serve you.</p>
    </div>
  `
}

export async function handleSiteApi(request, response, pathname, env = {}) {
  const db = await getDb(env)
  const usingMongo = Boolean(db)
  const strictPersistence = isStrictPersistenceEnabled(env)

  if (strictPersistence && !usingMongo) {
    sendJson(response, 503, {
      ok: false,
      message: 'Database storage is required for this site.',
    })
    return true
  }

  if (request.method === 'GET' && pathname === '/api/site-data') {
    if (!(await requirePriestAuth(db, request, response))) return true
    if (!requireSameOrigin(request, env, response)) return true

    const currentAdmin = await getAuthenticatedPriestUser(db, request)
    const adminPermissions = getAdminPermissions(currentAdmin)

    const [newsletters, orders, rsvps, contactMessages, squareWebhookEvents, orderEvents, adminAccessRequests] = usingMongo
      ? await Promise.all([
          listCollection(db, 'newsletters'),
          listCollection(db, 'orders'),
          listCollection(db, 'rsvps'),
          listCollection(db, 'contactMessages'),
          listCollection(db, 'squareWebhookEvents'),
          listRecentOrderEvents(db, 25),
          listCollection(db, 'adminAccessRequests'),
        ])
      : [
          [...memoryStore.newsletters].slice(0, 20),
          [...memoryStore.orders].slice(0, 20),
          [...memoryStore.rsvps].slice(0, 20),
          [...memoryStore.contactMessages].slice(0, 20),
          [...memoryStore.squareWebhookEvents].slice(0, 20),
          [...memoryStore.orderEvents].slice(0, 25),
          [...memoryStore.adminAccessRequests].slice(0, 20),
        ]

    sendJson(response, 200, {
      newsletters: newsletters.map((item) => ({
        email: item.email,
        createdAt: item.createdAt,
      })),
      orders: orders.map((item) => ({
        ...item,
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
      orderEvents: orderEvents.map((item) => ({
        ...item,
      })),
      adminPermissions,
      adminAccessRequests: adminPermissions.canViewAdminAccessRequests
        ? adminAccessRequests.map((item) => ({
            id: item.id,
            name: item.name,
            email: item.email,
            status: item.status,
            createdAt: item.createdAt,
            expiresAt: item.expiresAt,
            approvedAt: item.approvedAt,
            emailedAt: item.emailedAt,
          }))
        : [],
      squareSyncStatus: adminPermissions.canViewSquareSync ? await getSquareSyncStatus(db, env) : null,
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
        scheduledFor: entry.scheduledFor || '',
        orderCode: entry.orderCode || '',
        createdAt: entry.createdAt || '',
      },
    })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/payment-links') {
    const body = await readJsonBody(request)
    const result = await createPublicPaymentLink(env, request, body, db)

    if (!result.ok) {
      sendJson(response, 400, { ok: false, message: 'Service and amount are required.' })
      return true
    }

    sendJson(response, 200, {
      ok: true,
      paymentPageUrl: result.url,
      paymentLinkToken: result.token,
    })
    return true
  }

  if (request.method === 'GET' && pathname === '/api/runtime-config') {
    sendJson(response, 200, {
      ok: true,
      ...getPublicRuntimeConfig(env),
    })
    return true
  }

  if (request.method === 'DELETE' && pathname === '/api/site-data') {
    if (!(await requirePriestAuth(db, request, response))) return true
    const currentAdmin = await getAuthenticatedPriestUser(db, request)
    if (getAdminRole(currentAdmin) !== 'owner') {
      sendJson(response, 403, { ok: false, message: 'Admin permission required.' })
      return true
    }

    if (usingMongo) {
      await Promise.all([
        db.collection('newsletters').deleteMany({}),
        db.collection('users').deleteMany({}),
        db.collection('userSessions').deleteMany({}),
        db.collection('passwordResets').deleteMany({}),
        db.collection('emailVerifications').deleteMany({}),
        db.collection('orders').deleteMany({}),
        db.collection('orderEvents').deleteMany({}),
        db.collection('paymentLinks').deleteMany({}),
        db.collection('rsvps').deleteMany({}),
        db.collection('contactMessages').deleteMany({}),
        db.collection('adminAccessRequests').deleteMany({}),
      ])
    } else {
      memoryStore.newsletters = []
      memoryStore.users = []
      memoryStore.userSessions = []
      memoryStore.passwordResets = []
      memoryStore.emailVerifications = []
      memoryStore.orders = []
      memoryStore.orderEvents = []
      memoryStore.paymentLinks = []
      memoryStore.rsvps = []
      memoryStore.contactMessages = []
      memoryStore.adminAccessRequests = []
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

  if (request.method === 'GET' && pathname === '/api/users/me') {
    const user = await loadUserForRequest(db, request)
    sendJson(response, 200, {
      ok: true,
      authenticated: Boolean(user),
      user,
    })
    return true
  }

  if (request.method === 'GET' && pathname === '/api/users/orders') {
    const user = await loadUserForRequest(db, request)
    if (!user) {
      sendJson(response, 401, { ok: false, message: 'Unauthorized.' })
      return true
    }

    const fullUser = await getUserById(db, user.id)
    const orders = await listUserOrders(db, fullUser || user)
    sendJson(response, 200, {
      ok: true,
      user,
      orders,
      summary: {
        totalOrders: orders.length,
        inProgress: orders.filter((order) => order.type === 'service' && order.isInProgress).length,
        completed: orders.filter((order) => order.status === 'completed').length,
      },
    })
    return true
  }

  if (request.method === 'GET' && pathname === '/api/orders/lookup') {
    const searchParams = new URL(request.url, 'http://localhost').searchParams
    const orderCode = searchParams.get('code')?.trim().toUpperCase() || ''
    const email = normalizeEmail(searchParams.get('email') || '')

    if (!orderCode) {
      sendJson(response, 400, { ok: false, message: 'Order code is required.' })
      return true
    }

    const order = await lookupPublicOrder(db, orderCode, email)
    if (!order) {
      sendJson(response, 404, { ok: false, message: 'Order not found.' })
      return true
    }

    sendJson(response, 200, {
      ok: true,
      order,
      nextStep:
        order.status === 'refunded'
          ? 'The payment has been refunded.'
          : order.status === 'cancelled'
            ? 'The service was cancelled.'
          : order.status === 'refund_requested'
            ? 'A refund request is waiting for review.'
          : order.status === 'cancel_requested'
            ? 'A cancellation request is waiting for review.'
              : order.status === 'completed'
                ? 'The service is complete.'
                : order.scheduledFor
                  ? `The service is scheduled for ${formatScheduleDate(order.scheduledFor)}.`
                  : order.status === 'awaiting_completion'
                    ? 'Payment is recorded. The priest team will complete the service.'
                    : 'The request is waiting for review.',
    })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/orders/request-change') {
    if (!requireSameOrigin(request, env, response)) return true

    const body = await readJsonBody(request)
    const orderCode = typeof body.orderCode === 'string' ? body.orderCode.trim().toUpperCase() : ''
    const email = normalizeEmail(body.email)
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    const requestedType = typeof body.type === 'string' ? body.type.trim().toLowerCase() : ''
    const currentUser = await getAuthenticatedUser(db, request)

    if (!orderCode) {
      sendJson(response, 400, { ok: false, message: 'Order code is required.' })
      return true
    }

    const { order } = await findOrderPairByOrderCode(db, orderCode)
    if (!order) {
      sendJson(response, 404, { ok: false, message: 'Order not found.' })
      return true
    }

    const lookupEmail = order?.email || ''
    const authenticatedEmail = currentUser?.email ? normalizeEmail(currentUser.email) : ''
    if (email && normalizeEmail(lookupEmail) !== email) {
      sendJson(response, 403, { ok: false, message: 'Email does not match this order.' })
      return true
    }
    if (currentUser && authenticatedEmail && normalizeEmail(lookupEmail) !== authenticatedEmail) {
      sendJson(response, 403, { ok: false, message: 'Account does not match this order.' })
      return true
    }

    const supportType =
      requestedType === 'refund'
        ? 'refund'
        : requestedType === 'cancel'
          ? 'cancel'
          : order?.paymentReceivedAt
            ? 'refund'
            : 'cancel'

    const updatedAt = new Date().toISOString()
    const update = {
      supportRequestType: supportType,
      supportRequestedAt: updatedAt,
      supportRequestReason: reason,
      serviceStatus: supportType === 'refund' ? 'refund_requested' : 'cancel_requested',
      refundRequestedAt: supportType === 'refund' ? updatedAt : '',
    }

    await saveSupportRequest(db, order, null, update)
    await recordOrderEvent(
      db,
      order,
      supportType === 'refund' ? 'refund_requested' : 'cancel_requested',
      {
        message:
          supportType === 'refund'
            ? 'Refund request submitted.'
            : 'Cancellation request submitted.',
        details: reason,
        createdAt: updatedAt,
      },
      currentUser
        ? { type: 'user', name: currentUser.name || order.name || 'devotee', email: currentUser.email || lookupEmail }
        : { type: 'user', name: order.name || 'devotee', email: lookupEmail || email },
    )

    const recipientEmail = lookupEmail || email || currentUser?.email || ''
    let requestEmailSent = false
    let requestMailStatus = ''
    let requestMailError = ''

    if (recipientEmail) {
      const subject =
        supportType === 'refund'
          ? `Refund request received for ${order?.service || 'your service'}`
          : `Cancellation request received for ${order?.service || 'your service'}`
      const text = [
        `Namaste ${order?.name || currentUser?.name || 'devotee'},`,
        '',
        supportType === 'refund'
          ? 'We received your refund request.'
          : 'We received your cancellation request.',
        `Order code: ${orderCode}`,
        reason ? `Reason: ${reason}` : '',
        '',
        'The priest team will review the request and respond as needed.',
      ]
        .filter(Boolean)
        .join('\n')
      const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f1b18">
          <h2 style="margin: 0 0 12px">
            ${supportType === 'refund' ? 'Refund request received' : 'Cancellation request received'}
          </h2>
          <p style="margin: 0 0 8px">Namaste ${escapeHtml(order?.name || currentUser?.name || 'devotee')},</p>
          <p style="margin: 0 0 8px">
            ${
              supportType === 'refund'
                ? 'We received your refund request.'
                : 'We received your cancellation request.'
            }
          </p>
          <p style="margin: 0 0 8px"><strong>Order code:</strong> ${escapeHtml(orderCode)}</p>
          ${reason ? `<p style="margin: 0 0 12px"><strong>Reason:</strong> ${escapeHtml(reason)}</p>` : ''}
          <p style="margin: 0">The priest team will review the request and respond as needed.</p>
        </div>
      `

      const mailResult = await sendMail(env, {
        to: recipientEmail,
        subject,
        text,
        html,
        replyTo: RECIPIENT_EMAIL,
      })

      requestEmailSent = mailResult.sent
      requestMailStatus = mailResult.reason
      requestMailError = mailResult.errorMessage || ''
    }

    await sendMail(env, {
      to: RECIPIENT_EMAIL,
      subject: `Support request for ${orderCode}`,
      text: [
        `Order code: ${orderCode}`,
        `Type: ${supportType}`,
        `Name: ${order?.name || currentUser?.name || 'devotee'}`,
        `Email: ${lookupEmail || email || currentUser?.email || 'Not provided'}`,
        reason ? `Reason: ${reason}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f1b18">
          <h2 style="margin: 0 0 12px">Support request</h2>
          <p style="margin: 0 0 8px"><strong>Order code:</strong> ${escapeHtml(orderCode)}</p>
          <p style="margin: 0 0 8px"><strong>Type:</strong> ${escapeHtml(supportType)}</p>
          <p style="margin: 0 0 8px"><strong>Name:</strong> ${escapeHtml(order?.name || currentUser?.name || 'devotee')}</p>
          <p style="margin: 0 0 8px"><strong>Email:</strong> ${escapeHtml(lookupEmail || email || currentUser?.email || 'Not provided')}</p>
          ${reason ? `<p style="margin: 0 0 12px"><strong>Reason:</strong> ${escapeHtml(reason)}</p>` : ''}
        </div>
      `,
      replyTo: RECIPIENT_EMAIL,
    })

    sendJson(response, 200, {
      ok: true,
      message: supportType === 'refund' ? 'Refund request submitted.' : 'Cancellation request submitted.',
      requestEmailSent,
      requestMailStatus,
      requestMailError,
      entry: {
        ...order,
        ...update,
      },
    })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/webhooks/order-events') {
    if (!requireWebhookSecret(request, env)) {
      sendJson(response, 401, { ok: false, message: 'Unauthorized.' })
      return true
    }

    const body = await readJsonBody(request)
    const eventType = typeof body.eventType === 'string' ? body.eventType.trim().toLowerCase() : ''
    const orderCode = typeof body.orderCode === 'string' ? body.orderCode.trim().toUpperCase() : ''
    const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : ''
    const status = typeof body.status === 'string' ? body.status.trim().toLowerCase() : ''
    const scheduledFor = typeof body.scheduledFor === 'string' ? body.scheduledFor.trim() : ''
    const completionNote = typeof body.completionNote === 'string' ? body.completionNote.trim() : ''

    const { request: order } = requestId
      ? await findOrderPairByRequestId(db, requestId)
      : await findOrderPairByOrderCode(db, orderCode)

    if (!order) {
      sendJson(response, 404, { ok: false, message: 'Order not found.' })
      return true
    }

    const now = new Date().toISOString()
    const update = {}

    if (scheduledFor) {
      update.scheduledFor = scheduledFor
    }

    if (eventType.includes('paid') || status === 'paid' || status === 'succeeded') {
      update.paymentReceivedAt = order?.paymentReceivedAt || now
      update.paymentStatus = 'paid'
      update.serviceStatus = 'awaiting_completion'
    } else if (eventType.includes('complete') || status === 'completed') {
      update.serviceCompletedAt = order?.serviceCompletedAt || now
      update.serviceCompletionNotifiedAt = order?.serviceCompletionNotifiedAt || now
      update.serviceStatus = 'completed'
    } else if (eventType.includes('refund') || status === 'refunded') {
      update.serviceStatus = 'refund_requested'
      update.supportRequestType = 'refund'
      update.supportRequestedAt = order?.supportRequestedAt || now
      update.refundRequestedAt = order?.refundRequestedAt || now
    } else if (status === 'cancelled') {
      update.serviceStatus = 'cancelled'
      update.cancelledAt = order?.cancelledAt || now
      update.supportRequestType = 'cancel'
      update.supportRequestedAt = order?.supportRequestedAt || now
    } else if (eventType.includes('cancel')) {
      update.serviceStatus = 'cancel_requested'
      update.supportRequestType = 'cancel'
      update.supportRequestedAt = order?.supportRequestedAt || now
    }

    if (completionNote) {
      update.completionNote = completionNote
    }

    await saveSupportRequest(db, order, null, update)
    await recordOrderEvent(
      db,
      order,
      eventType.includes('paid') || status === 'paid' || status === 'succeeded'
        ? 'payment_received'
        : eventType.includes('complete') || status === 'completed'
          ? 'service_completed'
          : eventType.includes('refund') || status === 'refunded'
            ? 'refund_requested'
            : status === 'cancelled'
              ? 'cancelled'
              : 'cancel_requested',
      {
        message:
          eventType.includes('paid') || status === 'paid' || status === 'succeeded'
            ? 'Payment notification received.'
            : eventType.includes('complete') || status === 'completed'
              ? 'Completion notification received.'
              : eventType.includes('refund') || status === 'refunded'
                ? 'Refund notification received.'
                : status === 'cancelled'
                  ? 'Cancellation notification received.'
                  : 'Cancellation request notification received.',
        details: completionNote || '',
        createdAt: now,
      },
      { type: 'system', name: 'webhook', email: '' },
    )

    sendJson(response, 200, {
      ok: true,
      message: 'Webhook processed.',
      entry: {
        ...order,
        ...update,
      },
    })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/users/signup') {
    if (!requireSameOrigin(request, env, response)) return true

    const body = await readJsonBody(request)
    const email = normalizeEmail(body.email)
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const password = normalizePassword(body.password)

    if (!email || !name || !isValidPassword(password)) {
      sendJson(response, 400, {
        ok: false,
        message: 'Name, email, and a password with at least 8 characters are required.',
      })
      return true
    }

    const existingUser = await getUserByEmail(db, email)
    if (existingUser) {
      sendJson(response, 409, { ok: false, message: 'An account with this email already exists.' })
      return true
    }

    const now = new Date().toISOString()
    const user = {
      id: randomUUID(),
      name,
      email,
      passwordHash: hashPassword(password),
      phone: typeof body.phone === 'string' ? body.phone.trim() : '',
      notificationPrefs: normalizeNotificationPrefs(body.notificationPrefs, {
        serviceEmails: true,
        templeLetters: false,
      }),
      emailVerifiedAt: '',
      verificationSentAt: now,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    }

    if (db) {
      await getUsersCollection(db).insertOne(user)
    } else {
      memoryStore.users.unshift(user)
    }

    await attachOrdersToUser(db, user)
    const verification = await createEmailVerification(db, user.id)
    const verificationMail = await sendVerificationEmail(env, request, user, verification.token)
    const session = await createUserSession(db, user.id)
    setCookie(response, 'mandir_user_session', session.sessionId, getSessionCookieOptions(request, env, 60 * 60 * 24 * 30))

    sendJson(response, 200, {
      ok: true,
      message: verificationMail.sent ? 'Account created. Check your email to verify it.' : 'Account created.',
      verificationEmailSent: verificationMail.sent,
      verificationMailStatus: verificationMail.reason,
      verificationMailError: verificationMail.errorMessage || '',
      verificationUrl: env.NODE_ENV === 'production' ? '' : buildVerificationUrl(env, request, verification.token),
      user: serializeUser(user),
    })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/users/login') {
    if (!requireSameOrigin(request, env, response)) return true

    const body = await readJsonBody(request)
    const email = normalizeEmail(body.email)
    const password = normalizePassword(body.password)

    if (!email || !password) {
      sendJson(response, 400, { ok: false, message: 'Email and password are required.' })
      return true
    }

    const user = await getUserByEmail(db, email)
    if (!user || !verifyPassword(password, user.passwordHash)) {
      sendJson(response, 401, { ok: false, message: 'Invalid email or password.' })
      return true
    }

    const updatedAt = new Date().toISOString()
    const loginUpdate = { lastLoginAt: updatedAt, updatedAt }

    if (db) {
      await getUsersCollection(db).updateOne({ id: user.id }, { $set: loginUpdate })
    } else {
      Object.assign(user, loginUpdate)
    }

    await attachOrdersToUser(db, user)
    const session = await createUserSession(db, user.id)
    setCookie(response, 'mandir_user_session', session.sessionId, getSessionCookieOptions(request, env, 60 * 60 * 24 * 30))

    sendJson(response, 200, {
      ok: true,
      message: 'Logged in.',
      user: serializeUser({ ...user, ...loginUpdate }),
    })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/users/profile') {
    const currentUser = await requireUserAuth(db, request, response)
    if (!currentUser) return true
    if (!requireSameOrigin(request, env, response)) return true

    const body = await readJsonBody(request)

    const nextName = typeof body.name === 'string' ? body.name.trim() : currentUser.name || ''
    const nextPhone = typeof body.phone === 'string' ? body.phone.trim() : currentUser.phone || ''
    const nextEmail = normalizeEmail(body.email || currentUser.email)

    if (!nextName || !nextEmail) {
      sendJson(response, 400, { ok: false, message: 'Name and email are required.' })
      return true
    }

    const existingUser = await getUserByEmail(db, nextEmail)
    if (existingUser && existingUser.id !== currentUser.id) {
      sendJson(response, 409, { ok: false, message: 'Another account already uses that email.' })
      return true
    }

    const emailChanged = normalizeEmail(currentUser.email) !== nextEmail
    const updatedAt = new Date().toISOString()
    const update = {
      name: nextName,
      phone: nextPhone,
      email: nextEmail,
      updatedAt,
      emailVerifiedAt: emailChanged ? '' : currentUser.emailVerifiedAt || '',
      verificationSentAt: emailChanged ? updatedAt : currentUser.verificationSentAt || '',
      notificationPrefs: normalizeNotificationPrefs(body.notificationPrefs, currentUser.notificationPrefs || {}),
    }

    if (db) {
      await getUsersCollection(db).updateOne({ id: currentUser.id }, { $set: update })
    } else {
      Object.assign(currentUser, update)
    }

    await attachOrdersToUser(db, { ...currentUser, ...update })

    let verificationEmailSent = false
    let verificationMailStatus = ''
    let verificationMailError = ''
    let verificationUrl = ''

    if (emailChanged || !currentUser.emailVerifiedAt) {
      await clearUserEmailVerifications(db, currentUser.id)
      const verification = await createEmailVerification(db, currentUser.id)
      const mailResult = await sendVerificationEmail(env, request, { ...currentUser, ...update }, verification.token)
      verificationEmailSent = mailResult.sent
      verificationMailStatus = mailResult.reason
      verificationMailError = mailResult.errorMessage || ''
      verificationUrl = env.NODE_ENV === 'production' ? '' : buildVerificationUrl(env, request, verification.token)
    }

    sendJson(response, 200, {
      ok: true,
      message:
        verificationEmailSent || emailChanged
          ? 'Profile updated. Verify your email address.'
          : 'Profile updated.',
      verificationEmailSent,
      verificationMailStatus,
      verificationMailError,
      verificationUrl,
      user: serializeUser({ ...currentUser, ...update }),
    })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/users/change-password') {
    const currentUser = await requireUserAuth(db, request, response)
    if (!currentUser) return true
    if (!requireSameOrigin(request, env, response)) return true

    const body = await readJsonBody(request)
    const currentPassword = normalizePassword(body.currentPassword)
    const nextPassword = normalizePassword(body.newPassword)

    if (!currentPassword || !nextPassword) {
      sendJson(response, 400, { ok: false, message: 'Current password and new password are required.' })
      return true
    }

    if (!verifyPassword(currentPassword, currentUser.passwordHash)) {
      sendJson(response, 401, { ok: false, message: 'Current password is incorrect.' })
      return true
    }

    if (!isValidPassword(nextPassword)) {
      sendJson(response, 400, { ok: false, message: 'New password must be at least 8 characters.' })
      return true
    }

    const passwordHash = hashPassword(nextPassword)
    const updatedAt = new Date().toISOString()
    if (db) {
      await getUsersCollection(db).updateOne(
        { id: currentUser.id },
        { $set: { passwordHash, updatedAt } },
      )
    } else {
      Object.assign(currentUser, { passwordHash, updatedAt })
    }

    const currentSessionId = getCookie(request, 'mandir_user_session')
    await clearOtherUserSessions(db, currentUser.id, currentSessionId)

    sendJson(response, 200, {
      ok: true,
      message: 'Password updated.',
    })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/users/resend-verification') {
    const currentUser = await requireUserAuth(db, request, response)
    if (!currentUser) return true
    if (!requireSameOrigin(request, env, response)) return true

    if (currentUser.emailVerifiedAt) {
      sendJson(response, 200, { ok: true, message: 'Email is already verified.', verificationEmailSent: false })
      return true
    }

    await clearUserEmailVerifications(db, currentUser.id)
    const verification = await createEmailVerification(db, currentUser.id)
    const mailResult = await sendVerificationEmail(env, request, currentUser, verification.token)

    sendJson(response, 200, {
      ok: true,
      message: 'Verification email sent.',
      verificationEmailSent: mailResult.sent,
      verificationMailStatus: mailResult.reason,
      verificationMailError: mailResult.errorMessage || '',
      verificationUrl: env.NODE_ENV === 'production' ? '' : buildVerificationUrl(env, request, verification.token),
    })
    return true
  }

  if (request.method === 'GET' && pathname === '/api/users/verify-email') {
    const token = new URL(request.url, 'http://localhost').searchParams.get('token')?.trim() || ''

    if (!token) {
      sendJson(response, 400, { ok: false, message: 'Token is required.' })
      return true
    }

    const verification = await getEmailVerificationByToken(db, token)
    if (!verification) {
      sendJson(response, 400, { ok: false, message: 'Verification link is invalid or expired.' })
      return true
    }

    const user = await getUserById(db, verification.userId)
    if (!user) {
      sendJson(response, 404, { ok: false, message: 'Account not found.' })
      return true
    }

    const verifiedAt = new Date().toISOString()
    const update = {
      emailVerifiedAt: verifiedAt,
      updatedAt: verifiedAt,
    }

    if (db) {
      await getUsersCollection(db).updateOne({ id: user.id }, { $set: update })
    } else {
      Object.assign(user, update)
    }

    await markEmailVerificationUsed(db, verification.id, user.id)

    sendJson(response, 200, {
      ok: true,
      message: 'Email verified.',
      user: serializeUser({ ...user, ...update }),
    })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/users/logout') {
    if (!requireSameOrigin(request, env, response)) return true

    const sessionId = getCookie(request, 'mandir_user_session')
    if (sessionId) {
      if (usingMongo) {
        await getUserSessionsCollection(db).deleteOne({ sessionId })
      } else {
        memoryStore.userSessions = memoryStore.userSessions.filter((item) => item.sessionId !== sessionId)
      }
    }

    setCookie(response, 'mandir_user_session', '', {
      path: '/',
      maxAge: 0,
      sameSite: 'Strict',
      secure: getRequestProtocol(request, env) === 'https',
    })

    sendJson(response, 200, { ok: true, message: 'Logged out.' })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/users/forgot-password') {
    if (!requireSameOrigin(request, env, response)) return true

    const body = await readJsonBody(request)
    const email = normalizeEmail(body.email)

    if (!email) {
      sendJson(response, 400, { ok: false, message: 'Email is required.' })
      return true
    }

    const user = await getUserByEmail(db, email)
    if (user) {
      const reset = await createPasswordReset(db, user.id)
      const resetUrl = buildPasswordResetUrl(env, request, reset.token)
      const subject = 'Reset your Gourishankar Mandir password'
      const text = [
        `Namaste ${user.name || 'devotee'},`,
        '',
        'Use this link to reset your password:',
        resetUrl,
        '',
        'This link expires in 1 hour.',
      ].join('\n')
      const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f1b18">
          <h2 style="margin: 0 0 12px">Reset your password</h2>
          <p style="margin: 0 0 8px">Namaste ${escapeHtml(user.name || 'devotee')},</p>
          <p style="margin: 0 0 12px">
            Use this link to reset your password:
            <a href="${escapeHtml(resetUrl)}">${escapeHtml(resetUrl)}</a>
          </p>
          <p style="margin: 0">This link expires in 1 hour.</p>
        </div>
      `

      const mailResult = await sendMail(env, {
        to: user.email,
        subject,
        text,
        html,
        replyTo: RECIPIENT_EMAIL,
      })

      sendJson(response, 200, {
        ok: true,
        message: 'If that email exists, a reset link has been sent.',
        emailed: false,
        mailStatus: 'requested',
        mailError: '',
        resetUrl: env.NODE_ENV === 'production' ? '' : resetUrl,
      })
      return true
    }

    sendJson(response, 200, {
      ok: true,
      message: 'If that email exists, a reset link has been sent.',
      emailed: false,
      mailStatus: 'requested',
      mailError: '',
      resetUrl: '',
    })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/users/reset-password') {
    if (!requireSameOrigin(request, env, response)) return true

    const body = await readJsonBody(request)
    const token = typeof body.token === 'string' ? body.token.trim() : ''
    const password = normalizePassword(body.password)

    if (!token || !isValidPassword(password)) {
      sendJson(response, 400, {
        ok: false,
        message: 'Reset token and a password with at least 8 characters are required.',
      })
      return true
    }

    const reset = await getPasswordResetByToken(db, token)
    if (!reset) {
      sendJson(response, 400, { ok: false, message: 'Reset link is invalid or expired.' })
      return true
    }

    const user = await getUserById(db, reset.userId)
    if (!user) {
      sendJson(response, 404, { ok: false, message: 'Account not found.' })
      return true
    }

    const passwordHash = hashPassword(password)
    const updatedAt = new Date().toISOString()

    if (db) {
      await getUsersCollection(db).updateOne(
        { id: user.id },
        { $set: { passwordHash, updatedAt } },
      )
    } else {
      Object.assign(user, { passwordHash, updatedAt })
    }

    await markPasswordResetUsed(db, reset.id, user.id)
    await clearUserSessions(db, user.id)

    sendJson(response, 200, {
      ok: true,
      message: 'Password updated.',
    })
    return true
  }

  if (request.method === 'GET' && pathname === '/api/priest-auth/status') {
    const state = await getPriestAuthState(db)
    const authenticated = Boolean(await isPriestAuthenticated(db, request))
    sendJson(response, 200, {
      ok: true,
      configured: Boolean(state.configured),
      authenticated,
    })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/priest-auth/bootstrap') {
    if (!requireSameOrigin(request, env, response)) return true
    sendJson(response, 403, {
      ok: false,
      message: 'Admin accounts are provisioned manually and cannot be created from the website.',
    })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/priest-auth/request-access') {
    if (!requireSameOrigin(request, env, response)) return true

    const body = await readJsonBody(request)
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = normalizeEmail(body.email)
    const password = normalizePassword(body.password)

    if (!name || !email || !isValidPassword(password)) {
      sendJson(response, 400, {
        ok: false,
        message: 'Name, email, and a password of at least 8 characters are required.',
      })
      return true
    }

    const existingAdmin = await getAdminUserByEmail(db, email)
    if (existingAdmin) {
      sendJson(response, 409, {
        ok: false,
        message: 'An approved admin account already exists for this email.',
      })
      return true
    }

    const pendingRequest = await getPendingAdminAccessRequestByEmail(db, email)
    if (pendingRequest) {
      sendJson(response, 409, {
        ok: false,
        message: 'An admin access request is already pending for this email.',
      })
      return true
    }

    const { token, entry } = await createAdminAccessRequest(db, {
      name,
      email,
      passwordHash: hashPassword(password),
    })
    const approvalUrl = buildAdminAccessRequestApprovalUrl(env, request, token)
    const adminMail = buildAdminAccessRequestEmail({ name, email, approvalUrl })
    const adminMailRecipients = getAdminRecipientEmails(env)
    const adminMailResults = await Promise.all(
      adminMailRecipients.map((recipientEmail) =>
        sendMail(env, {
          to: recipientEmail,
          subject: adminMail.subject,
          text: adminMail.text,
          html: adminMail.html,
          replyTo: email,
        }),
      ),
    )
    const adminMailResult = {
      sent: adminMailResults.some((item) => item.sent),
      reason: adminMailResults.every((item) => item.reason === 'sent')
        ? 'sent'
        : adminMailResults.some((item) => item.sent)
          ? 'partial'
          : adminMailResults[0]?.reason || 'requested',
    }
    const applicantMail = await sendMail(env, {
      to: email,
      subject: 'Your admin access request was received',
      text: [
        `Namaste ${name},`,
        '',
        'Your admin access request was received and is waiting for approval.',
        'You will receive another email once it is approved.',
      ].join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f1b18">
          <h2 style="margin: 0 0 12px">Admin access request received</h2>
          <p style="margin: 0 0 8px">Namaste ${escapeHtml(name)},</p>
          <p style="margin: 0">Your admin access request was received and is waiting for approval. You will receive another email once it is approved.</p>
        </div>
      `,
      replyTo: RECIPIENT_EMAIL,
    })

    const emailedAt = new Date().toISOString()
    if (db) {
      await getAdminAccessRequestsCollection(db).updateOne(
        { id: entry.id },
        { $set: { emailedAt } },
      )
    } else {
      const index = memoryStore.adminAccessRequests.findIndex((item) => item.id === entry.id)
      if (index >= 0) {
        memoryStore.adminAccessRequests[index] = {
          ...memoryStore.adminAccessRequests[index],
          emailedAt,
        }
      }
    }

    sendJson(response, 200, {
      ok: true,
      message: 'Request submitted. An approval email was sent to the temple admins.',
      adminEmailSent: adminMailResult.sent,
      applicantEmailSent: applicantMail.sent,
      entry: {
        id: entry.id,
        name: entry.name,
        email: entry.email,
        createdAt: entry.createdAt,
        status: entry.status,
      },
    })
    return true
  }

  if (request.method === 'GET' && pathname === '/api/priest-auth/approve') {
    const searchParams = new URL(request.url, 'http://localhost').searchParams
    const token = searchParams.get('token')?.trim() || ''
    if (!token) {
      buildRedirect(response, '/priest-review?approval=invalid')
      return true
    }

    const requestEntry = await getAdminAccessRequestByToken(db, token)
    if (!requestEntry) {
      buildRedirect(response, '/priest-review?approval=invalid')
      return true
    }

    if (requestEntry.status === 'approved') {
      buildRedirect(response, '/priest-review?approval=approved')
      return true
    }

    let adminUser = await getAdminUserByEmail(db, requestEntry.email)
    if (!adminUser) {
      adminUser = {
        id: randomUUID(),
        name: requestEntry.name,
        email: requestEntry.email,
        passwordHash: requestEntry.passwordHash,
        role: 'staff',
        createdAt: requestEntry.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: '',
      }

      if (db) {
        await getAdminUsersCollection(db).insertOne(adminUser)
      } else {
        memoryStore.adminUsers.unshift(adminUser)
      }
    }

    const approvedAt = await markAdminAccessRequestApproved(db, requestEntry.id, adminUser.id)
    const approvalMail = buildAdminAccessApprovedEmail({ name: requestEntry.name })
    await sendMail(env, {
      to: requestEntry.email,
      subject: approvalMail.subject,
      text: approvalMail.text,
      html: approvalMail.html,
      replyTo: RECIPIENT_EMAIL,
    })

    if (db) {
      await getAdminUsersCollection(db).updateOne(
        { id: adminUser.id },
        { $set: { updatedAt: approvedAt } },
      )
    } else {
      const index = memoryStore.adminUsers.findIndex((item) => item.id === adminUser.id)
      if (index >= 0) {
        memoryStore.adminUsers[index] = {
          ...memoryStore.adminUsers[index],
          updatedAt: approvedAt,
        }
      }
    }

    buildRedirect(response, '/priest-review?approval=approved')
    return true
  }

  if (request.method === 'POST' && pathname === '/api/priest-auth/login') {
    if (!requireSameOrigin(request, env, response)) return true

    const body = await readJsonBody(request)
    const email = normalizeEmail(body.email)
    const password = normalizePassword(body.password)

    if (!email || !password) {
      sendJson(response, 400, { ok: false, message: 'Email and password are required.' })
      return true
    }

    const adminUser = await getAdminUserByEmail(db, email)
    if (!adminUser || !verifyPassword(password, adminUser.passwordHash)) {
      sendJson(response, 401, { ok: false, message: 'Invalid email or password.' })
      return true
    }

    const updatedAt = new Date().toISOString()
    const session = await createAdminUserSession(db, adminUser.id)
    setCookie(response, 'priest_review_session', session.sessionId, getSessionCookieOptions(request, env))
    const nextAdmin = {
      ...adminUser,
      role: getAdminRole(adminUser),
      lastLoginAt: updatedAt,
      updatedAt,
    }
    if (db) {
      await getAdminUsersCollection(db).updateOne({ id: adminUser.id }, { $set: { lastLoginAt: updatedAt, updatedAt } })
    } else {
      const index = memoryStore.adminUsers.findIndex((item) => item.id === adminUser.id)
      if (index >= 0) {
        memoryStore.adminUsers[index] = nextAdmin
      }
    }

    sendJson(response, 200, { ok: true, message: 'Signed in.', user: serializeAdminUser(nextAdmin) })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/priest-auth/logout') {
    if (!requireSameOrigin(request, env, response)) return true

    const sessionId = getCookie(request, 'priest_review_session')
    if (sessionId) {
      if (usingMongo) {
        await getAdminSessionsCollection(db).deleteOne({ sessionId })
      } else {
        memoryStore.adminSessions = memoryStore.adminSessions.filter(
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
    const currentUser = await getAuthenticatedUser(db, request)
    const id = randomUUID()
    const orderCode = generateOrderCode()
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
      paymentReceivedAt: '',
      paymentStatus: 'unpaid',
      donationId: '',
      serviceStatus: 'pending_review',
      scheduledFor: '',
      supportRequestType: '',
      supportRequestedAt: '',
      supportRequestReason: '',
      refundRequestedAt: '',
      refundedAt: '',
      refundStatus: '',
      refundSquareRefundId: '',
      serviceCompletedAt: '',
      serviceCompletionNotifiedAt: '',
      completionNote: '',
      orderCode,
      userId: currentUser?.id || '',
      createdAt: new Date().toISOString(),
    }

    await upsertCanonicalOrder(db, entry, null, currentUser)
    await recordOrderEvent(
      db,
      entry,
      'request_created',
      {
        message: `Service request submitted for ${service}.`,
        details: note,
        createdAt: entry.createdAt,
      },
      currentUser
        ? { type: 'user', name: currentUser.name || name, email: currentUser.email || email }
        : { type: 'user', name, email },
    )

    const subject = `Gourishankar Mandir service request: ${service}`
    const text = `Order code: ${orderCode}\nService: ${service}\nName: ${name}\nEmail: ${email}\nPhone: ${phone || 'Not provided'}\nDate: ${date || 'Not selected'}\n\n${note}`
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f1b18">
        <h2 style="margin: 0 0 12px">Gourishankar Mandir service request</h2>
        <p style="margin: 0 0 8px"><strong>Order code:</strong> ${escapeHtml(orderCode)}</p>
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

    let confirmationEmailSent = false
    let confirmationMailStatus = ''
    let confirmationMailError = ''

    if (email && shouldSendServiceEmails(currentUser)) {
      const trackUrl = buildOrderLookupUrl(env, request, orderCode, email)
      const confirmationText = [
        `Namaste ${name},`,
        '',
        `We received your request for ${service}.`,
        `Order code: ${orderCode}`,
        `Track it here: ${trackUrl}`,
        '',
        'The priests will review the request and send the next step by email.',
      ].join('\n')
      const confirmationHtml = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f1b18">
          <h2 style="margin: 0 0 12px">Your request was received</h2>
          <p style="margin: 0 0 8px">Namaste ${escapeHtml(name)},</p>
          <p style="margin: 0 0 8px">We received your request for <strong>${escapeHtml(service)}</strong>.</p>
          <p style="margin: 0 0 8px"><strong>Order code:</strong> ${escapeHtml(orderCode)}</p>
          <p style="margin: 0 0 12px">
            Track it here:
            <a href="${escapeHtml(trackUrl)}">${escapeHtml(trackUrl)}</a>
          </p>
          <p style="margin: 0">The priests will review the request and send the next step by email.</p>
        </div>
      `

      const confirmationMail = await sendMail(env, {
        to: email,
        subject: `Your Gourishankar Mandir request code: ${orderCode}`,
        text: confirmationText,
        html: confirmationHtml,
        replyTo: RECIPIENT_EMAIL,
      })

      confirmationEmailSent = confirmationMail.sent
      confirmationMailStatus = confirmationMail.reason
      confirmationMailError = confirmationMail.errorMessage || ''
    }

    sendJson(response, 200, {
      ok: true,
      message: confirmationEmailSent ? 'Received. A confirmation email was sent.' : 'Received.',
      emailed: mailResult.sent,
      mailStatus: mailResult.reason,
      mailError: mailResult.errorMessage || '',
      confirmationEmailSent,
      confirmationMailStatus,
      confirmationMailError,
      orderCode,
      trackUrl: buildOrderLookupUrl(env, request, orderCode, email),
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
    const scheduledFor = typeof body.scheduledFor === 'string' ? body.scheduledFor.trim() : ''

    if (!requestId || !Number.isInteger(amountCents) || amountCents <= 0) {
      sendJson(response, 400, { ok: false, message: 'Request id and amount are required.' })
      return true
    }

    const { request: entry } = await findOrderPairByRequestId(db, requestId)

    if (!entry) {
      sendJson(response, 404, { ok: false, message: 'Service request not found.' })
      return true
    }

    const orderCode = entry.orderCode || generateOrderCode()
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
        scheduledFor,
        orderCode,
      },
      db,
    )
    const paymentPageUrl = paymentLink.url
    const subject = `Your Gourishankar Mandir payment page is ready`
    const scheduledForLabel = scheduledFor ? formatScheduleDate(scheduledFor) : ''
    const recipientUser = entry.userId ? await getUserById(db, entry.userId) : await getUserByEmail(db, entry.email)
    const text = [
      `Namaste ${entry.name},`,
      '',
      `The priests reviewed your ${entry.service} request.`,
      `Order code: ${orderCode}`,
      scheduledForLabel ? `Target completion: ${scheduledForLabel}` : '',
      `You can complete the payment here: ${paymentPageUrl}`,
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
        <p style="margin: 0 0 8px"><strong>Order code:</strong> ${escapeHtml(orderCode)}</p>
        ${scheduledForLabel ? `<p style="margin: 0 0 8px"><strong>Target completion:</strong> ${escapeHtml(scheduledForLabel)}</p>` : ''}
        <p style="margin: 0 0 12px">
          Complete the payment here:
          <a href="${escapeHtml(paymentPageUrl)}">${escapeHtml(paymentPageUrl)}</a>
        </p>
        ${note ? `<p style="margin: 0 0 12px"><strong>Priest note:</strong> ${escapeHtml(note)}</p>` : ''}
        <p style="margin: 0">If you have questions, please reply to this email.</p>
      </div>
    `

    const mailResult =
      recipientUser && !shouldSendServiceEmails(recipientUser)
        ? { sent: false, reason: 'user_opted_out', errorMessage: '' }
        : await sendMail(env, {
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
      paymentPageToken: paymentLink.token,
      scheduledFor,
      orderCode,
    }

    Object.assign(entry, update)
    await upsertCanonicalOrder(db, entry, null, recipientUser || entry)
    const adminUser = await getAuthenticatedPriestUser(db, request)
    await recordOrderEvent(
      db,
      entry,
      'payment_page_sent',
      {
        message: `Payment page sent for ${entry.service}.`,
        details: note,
        createdAt: updatedAt,
      },
      adminUser
        ? {
            type: 'admin',
            name: adminUser.name || 'priest',
            email: adminUser.email || '',
            role: adminUser.role || 'staff',
          }
        : { type: 'admin', name: 'priest', email: '' },
    )

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
    const orderCode = paymentLink.entry?.orderCode || ''
    const subject = `Your Gourishankar Mandir payment page is ready`
    const text = [
      `Namaste ${name},`,
      '',
      `Your payment page is ready.`,
      orderCode ? `Order code: ${orderCode}` : '',
      `You can complete the payment here: ${paymentPageUrl}`,
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
        ${orderCode ? `<p style="margin: 0 0 8px"><strong>Order code:</strong> ${escapeHtml(orderCode)}</p>` : ''}
        <p style="margin: 0 0 12px">
          Complete the payment here:
          <a href="${escapeHtml(paymentPageUrl)}">${escapeHtml(paymentPageUrl)}</a>
        </p>
        ${note ? `<p style="margin: 0 0 12px"><strong>Note:</strong> ${escapeHtml(note)}</p>` : ''}
        <p style="margin: 0">If you have questions, please reply to this email.</p>
      </div>
    `

    const recipientUser = await getUserByEmail(db, email)
    const mailResult =
      recipientUser && !shouldSendServiceEmails(recipientUser)
        ? { sent: false, reason: 'user_opted_out', errorMessage: '' }
        : await sendMail(env, {
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
    const paymentLinkToken = typeof body.paymentLinkToken === 'string' ? body.paymentLinkToken.trim() : ''
    const paymentLink = paymentLinkToken ? await findPaymentLinkByToken(db, paymentLinkToken) : null
    const currentUser = await getAuthenticatedUser(db, request)
    const linkedRequestId = paymentLink?.requestId || ''
    const linkedService = paymentLink?.service || note || 'Custom payment'
    const linkedName = paymentLink?.name || ''
    const linkedEmail = buyerEmailAddress || paymentLink?.email || ''
    const linkedPhone = buyerPhoneNumber || paymentLink?.phone || ''
    const linkedUser =
      currentUser ||
      (linkedEmail ? await getUserByEmail(db, linkedEmail) : null)
    let orderCode = paymentLink?.orderCode || ''
    let scheduledFor = paymentLink?.scheduledFor || ''

    if (!Number.isInteger(amountCents) || amountCents <= 0 || !sourceId) {
      sendJson(response, 400, {
        ok: false,
        message: 'Amount and payment token are required.',
      })
      return true
    }

    if (paymentLink) {
      if (!orderCode) {
        orderCode = generateOrderCode()
      }
      const minimumAmountCents = Number.isInteger(paymentLink.amountCents) && paymentLink.amountCents > 0 ? paymentLink.amountCents : 0

      if (minimumAmountCents > 0 && amountCents < minimumAmountCents) {
        sendJson(response, 400, {
          ok: false,
          message: `The payment amount cannot be less than $${Math.round(minimumAmountCents / 100)}.`,
        })
        return true
      }
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

    const payment = result.payment || {}
    const donationId = randomUUID()
    const paidAt = new Date().toISOString()
    const donationEntry = {
      id: donationId,
      requestId: linkedRequestId,
      service: linkedService,
      amountCents,
      donorName: linkedName,
      donorEmail: linkedEmail,
      donorPhone: linkedPhone,
      squarePaymentId: payment.id || undefined,
      paymentStatus: String(payment.status || 'COMPLETED').toLowerCase(),
      serviceStatus: linkedRequestId ? 'awaiting_completion' : 'received',
      scheduledFor,
      serviceCompletedAt: '',
      serviceCompletionNotifiedAt: '',
      orderCode,
      userId: linkedUser?.id || '',
      createdAt: paidAt,
      paidAt,
    }

    await upsertCanonicalOrder(db, null, donationEntry, linkedUser || null)

    if (linkedRequestId) {
      const { request: requestEntry } = await findOrderPairByRequestId(db, linkedRequestId)

      if (requestEntry) {
        scheduledFor = requestEntry.scheduledFor || scheduledFor || ''
        if (!orderCode) {
          orderCode = requestEntry.orderCode || generateOrderCode()
        }
        const update = {
          paymentReceivedAt: paidAt,
          paymentStatus: 'paid',
          donationId,
          serviceStatus: 'awaiting_completion',
          scheduledFor: requestEntry.scheduledFor || scheduledFor || '',
          squarePaymentId: payment.id || undefined,
          userId: requestEntry.userId || linkedUser?.id || '',
          orderCode,
        }

        await updateOrderPair(db, requestEntry, donationEntry, update)
      }
    }

    await recordOrderEvent(
      db,
      donationEntry,
      'payment_received',
      {
        message: `Payment received for ${linkedService}.`,
        details: `Amount: ${formatUsd(amountCents)}`,
        createdAt: paidAt,
      },
      linkedUser
        ? {
            type: 'user',
            name: linkedUser.name || linkedName || 'devotee',
            email: linkedUser.email || linkedEmail,
          }
        : { type: 'user', name: linkedName || 'devotee', email: linkedEmail },
    )

    let confirmationEmailSent = false
    let confirmationMailStatus = ''
    let confirmationMailError = ''

    if (linkedEmail && shouldSendServiceEmails(linkedUser)) {
      const subject = `We received your payment for ${linkedService}`
      const scheduledForLabel = scheduledFor ? formatScheduleDate(scheduledFor) : ''
      const text = buildPaymentConfirmationText({
        name: linkedName || 'devotee',
        service: linkedService,
        amountCents,
        orderCode,
        scheduledFor: scheduledForLabel,
        trackUrl: orderCode ? buildOrderLookupUrl(env, request, orderCode, linkedEmail) : '',
        nextSteps: buildPaymentNextSteps({
          isServiceRequest: Boolean(linkedRequestId),
          scheduledFor,
        }),
      })
      const html = buildPaymentConfirmationHtml({
        name: linkedName || 'devotee',
        service: linkedService,
        amountCents,
        orderCode,
        scheduledFor: scheduledForLabel,
        trackUrl: orderCode ? buildOrderLookupUrl(env, request, orderCode, linkedEmail) : '',
        nextSteps: buildPaymentNextSteps({
          isServiceRequest: Boolean(linkedRequestId),
          scheduledFor,
        }),
      })

      const mailResult = await sendMail(env, {
        to: linkedEmail,
        subject,
        text,
        html,
        replyTo: RECIPIENT_EMAIL,
      })

      confirmationEmailSent = mailResult.sent
      confirmationMailStatus = mailResult.reason
      confirmationMailError = mailResult.errorMessage || ''
    }

    const responsePayload = {
      ok: true,
      message: 'Received.',
      payment,
      donation: {
        ...donationEntry,
        confirmationEmailSent,
      },
      confirmationEmailSent,
      confirmationMailStatus,
      confirmationMailError,
      nextSteps,
      serviceStatus: linkedRequestId ? 'awaiting_completion' : 'received',
      orderCode,
    }

    sendJson(response, 200, responsePayload)
    return true
  }

  if (request.method === 'POST' && pathname === '/api/service-requests/mark-complete') {
    if (!(await requirePriestAuth(db, request, response))) return true
    if (!requireSameOrigin(request, env, response)) return true

    const body = await readJsonBody(request)
    const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : ''
    const completionNote = typeof body.note === 'string' ? body.note.trim() : ''

    if (!requestId) {
      sendJson(response, 400, { ok: false, message: 'Request id is required.' })
      return true
    }

    const { request: requestEntry, donation: donationEntry } = await findOrderPairByRequestId(db, requestId)

    if (!requestEntry) {
      sendJson(response, 404, { ok: false, message: 'Service request not found.' })
      return true
    }

    const completedAt = new Date().toISOString()
    const update = {
      serviceStatus: 'completed',
      serviceCompletedAt: completedAt,
      serviceCompletionNotifiedAt: completedAt,
      completionNote,
    }
    await updateOrderPair(
      db,
      requestEntry,
      donationEntry,
      update,
      {
        serviceStatus: 'completed',
        serviceCompletedAt: completedAt,
        serviceCompletionNotifiedAt: completedAt,
      },
    )
    const adminUser = await getAuthenticatedPriestUser(db, request)
    await recordOrderEvent(
      db,
      requestEntry,
      'service_completed',
      {
        message: `Service marked complete for ${serviceLabel}.`,
        details: completionNote,
        createdAt: completedAt,
      },
      adminUser
        ? {
            type: 'admin',
            name: adminUser.name || 'priest',
            email: adminUser.email || '',
            role: adminUser.role || 'staff',
          }
        : { type: 'admin', name: 'priest', email: '' },
    )

    let completionEmailSent = false
    let completionMailStatus = ''
    let completionMailError = ''
    const recipientEmail = requestEntry.email || donationEntry?.donorEmail || ''
    const recipientUser =
      (requestEntry.userId && (await getUserById(db, requestEntry.userId))) ||
      (donationEntry?.userId && (await getUserById(db, donationEntry.userId))) ||
      (recipientEmail ? await getUserByEmail(db, recipientEmail) : null)
    const serviceLabel = requestEntry.service || donationEntry?.service || 'Your service'
    const donorName = requestEntry.name || donationEntry?.donorName || 'devotee'
    const donationAmountCents = donationEntry?.amountCents || requestEntry.paymentPageAmountCents || 0
    const orderCode = requestEntry.orderCode || donationEntry?.orderCode || ''

    if (recipientEmail && shouldSendServiceEmails(recipientUser)) {
      const subject = `Your ${serviceLabel} is complete`
      const text = buildCompletionText({
        name: donorName,
        service: serviceLabel,
        amountCents: donationAmountCents,
        orderCode,
        completionNote,
      })
      const html = buildCompletionHtml({
        name: donorName,
        service: serviceLabel,
        amountCents: donationAmountCents,
        orderCode,
        completionNote,
      })

      const mailResult = await sendMail(env, {
        to: recipientEmail,
        subject,
        text,
        html,
        replyTo: RECIPIENT_EMAIL,
      })

      completionEmailSent = mailResult.sent
      completionMailStatus = mailResult.reason
      completionMailError = mailResult.errorMessage || ''
    }

    sendJson(response, 200, {
      ok: true,
      message: 'Service marked complete.',
      entry: {
        ...requestEntry,
        ...update,
      },
      donation: donationEntry
        ? {
            ...donationEntry,
            serviceStatus: 'completed',
            serviceCompletedAt: completedAt,
            serviceCompletionNotifiedAt: completedAt,
          }
        : null,
      completionEmailSent,
      completionMailStatus,
      completionMailError,
    })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/service-requests/process-refund') {
    if (!(await requirePriestAuth(db, request, response))) return true
    if (!requireSameOrigin(request, env, response)) return true

    const body = await readJsonBody(request)
    const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : ''
    const refundReason = typeof body.reason === 'string' ? body.reason.trim() : 'Service refund'

    if (!requestId) {
      sendJson(response, 400, { ok: false, message: 'Request id is required.' })
      return true
    }

    const { request: requestEntry, donation: donationEntry } = await findOrderPairByRequestId(db, requestId)

    if (!requestEntry) {
      sendJson(response, 404, { ok: false, message: 'Service request not found.' })
      return true
    }

    const squarePaymentId = requestEntry.squarePaymentId || donationEntry?.squarePaymentId || ''
    const refundAmountCents = Number(donationEntry?.amountCents || requestEntry.paymentPageAmountCents || 0)

    if (!squarePaymentId) {
      sendJson(response, 400, { ok: false, message: 'No Square payment id is available for this order.' })
      return true
    }

    if (!Number.isInteger(refundAmountCents) || refundAmountCents <= 0) {
      sendJson(response, 400, { ok: false, message: 'Refund amount is unavailable.' })
      return true
    }

    const refundResult = await createSquareRefund(env, {
      paymentId: squarePaymentId,
      amountCents: refundAmountCents,
      reason: refundReason,
    })

    if (!refundResult.ok) {
      const status = refundResult.reason === 'missing_square_config' ? 501 : 502
      sendJson(response, status, {
        ok: false,
        message:
          refundResult.reason === 'missing_square_config'
            ? 'Square refunds are not configured.'
            : refundResult.message || 'Unable to create Square refund.',
      })
      return true
    }

    const refundedAt = new Date().toISOString()
    const update = {
      serviceStatus: 'refunded',
      refundRequestedAt: requestEntry.refundRequestedAt || refundedAt,
      refundedAt,
      refundStatus: refundResult.refund?.status || 'COMPLETED',
      refundSquareRefundId: refundResult.refund?.id || '',
      supportRequestType: 'refund',
      supportRequestedAt: requestEntry.supportRequestedAt || refundedAt,
      supportRequestReason: refundReason,
    }
    await updateOrderPair(
      db,
      requestEntry,
      donationEntry,
      update,
      {
        serviceStatus: 'refunded',
        refundRequestedAt: donationEntry?.refundRequestedAt || refundedAt,
        refundedAt,
        refundStatus: refundResult.refund?.status || 'COMPLETED',
        refundSquareRefundId: refundResult.refund?.id || '',
      },
    )
    const adminUser = await getAuthenticatedPriestUser(db, request)
    await recordOrderEvent(
      db,
      requestEntry,
      'refund_processed',
      {
        message: `Refund processed for ${requestEntry.service || donationEntry?.service || 'service'}.`,
        details: refundReason,
        createdAt: refundedAt,
      },
      adminUser
        ? {
            type: 'admin',
            name: adminUser.name || 'priest',
            email: adminUser.email || '',
            role: adminUser.role || 'staff',
          }
        : { type: 'admin', name: 'priest', email: '' },
    )

    const recipientEmail = requestEntry.email || donationEntry?.donorEmail || ''
    const recipientUser =
      (requestEntry.userId && (await getUserById(db, requestEntry.userId))) ||
      (donationEntry?.userId && (await getUserById(db, donationEntry.userId))) ||
      (recipientEmail ? await getUserByEmail(db, recipientEmail) : null)
    let refundEmailSent = false
    let refundMailStatus = ''
    let refundMailError = ''

    if (recipientEmail && shouldSendServiceEmails(recipientUser)) {
      const subject = `Your refund for ${requestEntry.service || donationEntry?.service || 'your service'} was processed`
      const text = [
        `Namaste ${requestEntry.name || donationEntry?.donorName || 'devotee'},`,
        '',
        `Your refund for order ${requestEntry.orderCode || donationEntry?.orderCode || requestId} has been processed.`,
        `Amount: ${formatUsd(refundAmountCents)}`,
        refundReason ? `Reason: ${refundReason}` : '',
        '',
        'If you have any questions, please reply to this email.',
      ]
        .filter(Boolean)
        .join('\n')
      const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f1b18">
          <h2 style="margin: 0 0 12px">Refund processed</h2>
          <p style="margin: 0 0 8px">Namaste ${escapeHtml(requestEntry.name || donationEntry?.donorName || 'devotee')},</p>
          <p style="margin: 0 0 8px">
            Your refund for order <strong>${escapeHtml(requestEntry.orderCode || donationEntry?.orderCode || requestId)}</strong>
            has been processed.
          </p>
          <p style="margin: 0 0 8px"><strong>Amount:</strong> ${escapeHtml(formatUsd(refundAmountCents))}</p>
          ${refundReason ? `<p style="margin: 0 0 12px"><strong>Reason:</strong> ${escapeHtml(refundReason)}</p>` : ''}
          <p style="margin: 0">If you have any questions, please reply to this email.</p>
        </div>
      `

      const mailResult = await sendMail(env, {
        to: recipientEmail,
        subject,
        text,
        html,
        replyTo: RECIPIENT_EMAIL,
      })

      refundEmailSent = mailResult.sent
      refundMailStatus = mailResult.reason
      refundMailError = mailResult.errorMessage || ''
    }

    sendJson(response, 200, {
      ok: true,
      message: 'Refund processed.',
      refund: refundResult.refund,
      entry: {
        ...requestEntry,
        ...update,
      },
      donation: donationEntry
        ? {
            ...donationEntry,
            serviceStatus: 'refunded',
            refundRequestedAt: donationEntry.refundRequestedAt || refundedAt,
            refundedAt,
            refundStatus: refundResult.refund?.status || 'COMPLETED',
            refundSquareRefundId: refundResult.refund?.id || '',
          }
        : null,
      refundEmailSent,
      refundMailStatus,
      refundMailError,
    })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/service-requests/process-cancellation') {
    if (!(await requirePriestAuth(db, request, response))) return true
    if (!requireSameOrigin(request, env, response)) return true

    const body = await readJsonBody(request)
    const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : ''
    const cancellationReason = typeof body.reason === 'string' ? body.reason.trim() : 'Service cancellation'

    if (!requestId) {
      sendJson(response, 400, { ok: false, message: 'Request id is required.' })
      return true
    }

    const { request: requestEntry, donation: donationEntry } = await findOrderPairByRequestId(db, requestId)

    if (!requestEntry) {
      sendJson(response, 404, { ok: false, message: 'Service request not found.' })
      return true
    }

    if (requestEntry.serviceStatus === 'cancelled') {
      sendJson(response, 200, {
        ok: true,
        message: 'Service is already marked cancelled.',
        entry: requestEntry,
        cancellationEmailSent: false,
        cancellationMailStatus: 'already_cancelled',
        cancellationMailError: '',
      })
      return true
    }
    const cancelledAt = new Date().toISOString()
    const update = {
      serviceStatus: 'cancelled',
      cancelledAt,
      supportRequestType: 'cancel',
      supportRequestedAt: requestEntry.supportRequestedAt || donationEntry?.supportRequestedAt || cancelledAt,
      supportRequestReason: cancellationReason,
    }
    await updateOrderPair(
      db,
      requestEntry,
      donationEntry,
      update,
      {
        serviceStatus: 'cancelled',
        cancelledAt,
        supportRequestType: 'cancel',
        supportRequestedAt: donationEntry?.supportRequestedAt || cancelledAt,
        supportRequestReason: cancellationReason,
      },
    )
    const adminUser = await getAuthenticatedPriestUser(db, request)
    await recordOrderEvent(
      db,
      requestEntry,
      'cancelled',
      {
        message: `Service cancelled for ${requestEntry.service || donationEntry?.service || 'service'}.`,
        details: cancellationReason,
        createdAt: cancelledAt,
      },
      adminUser
        ? {
            type: 'admin',
            name: adminUser.name || 'priest',
            email: adminUser.email || '',
            role: adminUser.role || 'staff',
          }
        : { type: 'admin', name: 'priest', email: '' },
    )

    const recipientEmail = requestEntry.email || donationEntry?.donorEmail || ''
    const recipientUser =
      (requestEntry.userId && (await getUserById(db, requestEntry.userId))) ||
      (donationEntry?.userId && (await getUserById(db, donationEntry.userId))) ||
      (recipientEmail ? await getUserByEmail(db, recipientEmail) : null)
    const shouldSendServiceMail = shouldSendServiceEmails(recipientUser)
    let cancellationEmailSent = false
    let cancellationMailStatus = 'skipped'
    let cancellationMailError = ''

    if (recipientEmail && shouldSendServiceMail) {
      const subject = `Service cancelled for ${requestEntry.service || donationEntry?.service || 'your service'}`
      const text = [
        `Namaste ${requestEntry.name || donationEntry?.donorName || 'devotee'},`,
        '',
        'Your service has been marked cancelled by the priest team.',
        `Order code: ${requestEntry.orderCode || donationEntry?.orderCode || requestId}`,
        cancellationReason ? `Reason: ${cancellationReason}` : '',
        '',
        'If you need anything else, you can reply to this email or contact the temple.',
      ]
        .filter(Boolean)
        .join('\n')
      const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f1b18">
          <h2 style="margin: 0 0 12px">Service cancelled</h2>
          <p style="margin: 0 0 8px">Namaste ${escapeHtml(requestEntry.name || donationEntry?.donorName || 'devotee')},</p>
          <p style="margin: 0 0 8px">Your service has been marked cancelled by the priest team.</p>
          <p style="margin: 0 0 8px"><strong>Order code:</strong> ${escapeHtml(requestEntry.orderCode || donationEntry?.orderCode || requestId)}</p>
          ${cancellationReason ? `<p style="margin: 0 0 12px"><strong>Reason:</strong> ${escapeHtml(cancellationReason)}</p>` : ''}
          <p style="margin: 0">If you need anything else, you can reply to this email or contact the temple.</p>
        </div>
      `

      const cancellationMailResult = await sendMail(env, {
        to: recipientEmail,
        subject,
        text,
        html,
        replyTo: RECIPIENT_EMAIL,
      })

      cancellationEmailSent = cancellationMailResult.sent
      cancellationMailStatus = cancellationMailResult.reason
      cancellationMailError = cancellationMailResult.errorMessage || ''
    }

    sendJson(response, 200, {
      ok: true,
      message: 'Service marked cancelled.',
      entry: {
        ...requestEntry,
        ...donationEntry,
        ...update,
      },
      cancellationEmailSent,
      cancellationMailStatus,
      cancellationMailError,
    })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/webhooks/square') {
    const rawBody = await readTextBody(request)
    const validation = verifySquareWebhookSignature(request, env, rawBody, pathname)
    if (!validation.ok) {
      sendJson(response, 403, { ok: false, message: 'Invalid webhook signature.' })
      return true
    }

    let body
    try {
      body = rawBody ? JSON.parse(rawBody) : {}
    } catch {
      sendJson(response, 400, { ok: false, message: 'Invalid webhook payload.' })
      return true
    }

    const eventId = typeof body.event_id === 'string' ? body.event_id.trim() : ''
    const eventType = String(body.type || body.event_type || '').trim().toLowerCase()
    const dataObject = body?.data?.object || {}
    const paymentId =
      typeof dataObject?.payment?.id === 'string'
        ? dataObject.payment.id.trim()
        : typeof dataObject?.refund?.payment_id === 'string'
          ? dataObject.refund.payment_id.trim()
          : ''
    const refundId = typeof dataObject?.refund?.id === 'string' ? dataObject.refund.id.trim() : ''
    const paymentStatus = String(dataObject?.payment?.status || '').trim().toUpperCase()
    const refundStatus = String(dataObject?.refund?.status || '').trim().toUpperCase()
    const paymentRefundedAmount = Number(dataObject?.payment?.refunded_money?.amount || 0)
    const paymentTotalAmount = Number(dataObject?.payment?.amount_money?.amount || 0)

    if (eventId && (await hasProcessedSquareWebhookEvent(db, eventId))) {
      sendJson(response, 200, { ok: true, message: 'Webhook already processed.' })
      return true
    }

    const { order } = paymentId ? await findOrderPairByPaymentId(db, paymentId) : { order: null }

    let updates = {}

    if (order) {
      const now = new Date().toISOString()

      if ((eventType === 'payment.created' || eventType === 'payment.updated') && paymentStatus) {
        if (paymentStatus === 'CANCELED') {
          updates = {
            ...updates,
            serviceStatus: 'cancelled',
            cancelledAt: order?.cancelledAt || dataObject?.payment?.updated_at || now,
            supportRequestType: 'cancel',
            supportRequestedAt: order?.supportRequestedAt || now,
          }
        } else if (paymentStatus === 'COMPLETED') {
          updates = {
            ...updates,
            paymentReceivedAt: order?.paymentReceivedAt || dataObject?.payment?.updated_at || now,
            paymentStatus: 'paid',
            serviceStatus: 'awaiting_completion',
          }
        }

        if (paymentRefundedAmount > 0) {
          updates = {
            ...updates,
            refundStatus: paymentRefundedAmount >= paymentTotalAmount && paymentTotalAmount > 0 ? 'COMPLETED' : 'PARTIALLY_REFUNDED',
            refundedAt:
              paymentRefundedAmount >= paymentTotalAmount && paymentTotalAmount > 0
                ? order?.refundedAt || dataObject?.payment?.updated_at || now
                : order?.refundedAt || '',
            refundRequestedAt: order?.refundRequestedAt || now,
            supportRequestType: 'refund',
            supportRequestedAt: order?.supportRequestedAt || now,
          }
          if (paymentRefundedAmount >= paymentTotalAmount && paymentTotalAmount > 0) {
            updates.serviceStatus = 'refunded'
          }
        }
      }

      if ((eventType === 'refund.created' || eventType === 'refund.updated') && refundStatus) {
        if (refundStatus === 'COMPLETED') {
          updates = {
            ...updates,
            serviceStatus: 'refunded',
            refundedAt: order?.refundedAt || dataObject?.refund?.updated_at || now,
            refundStatus,
            refundRequestedAt: order?.refundRequestedAt || now,
            supportRequestType: 'refund',
            supportRequestedAt: order?.supportRequestedAt || now,
          }
        } else if (refundStatus === 'PENDING') {
          updates = {
            ...updates,
            serviceStatus: order?.serviceStatus || 'refund_requested',
            refundStatus,
            refundRequestedAt: order?.refundRequestedAt || dataObject?.refund?.created_at || now,
            supportRequestType: 'refund',
            supportRequestedAt: order?.supportRequestedAt || now,
          }
        } else if (refundStatus === 'FAILED' || refundStatus === 'REJECTED') {
          updates = {
            ...updates,
            refundStatus,
          }
        }
      }

      if (Object.keys(updates).length) {
        await updateOrderPair(db, order, null, updates)
        await recordOrderEvent(
          db,
          order,
          eventType.includes('refund') || refundStatus ? 'square_refund_update' : 'square_payment_update',
          {
            message:
              eventType.includes('refund') || refundStatus
                ? 'Square refund status changed.'
                : 'Square payment status changed.',
            details: JSON.stringify(updates),
            createdAt: now,
          },
          { type: 'system', name: 'square', email: '' },
        )
      }
    }

    if (eventId) {
      await saveSquareWebhookEvent(db, {
        eventId,
        eventType,
        paymentId,
        refundId,
        createdAt: body.created_at || new Date().toISOString(),
      })
    }

    sendJson(response, 200, {
      ok: true,
      message: 'Webhook processed.',
      entry: {
        ...(order || {}),
        ...updates,
      },
    })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/square/sync') {
    if (!(await requirePriestAuth(db, request, response))) return true
    if (!requireSameOrigin(request, env, response)) return true
    const currentAdmin = await getAuthenticatedPriestUser(db, request)
    if (getAdminRole(currentAdmin) !== 'owner') {
      sendJson(response, 403, { ok: false, message: 'Admin permission required.' })
      return true
    }

    const body = await readJsonBody(request)
    const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : ''
    const orderCode = typeof body.orderCode === 'string' ? body.orderCode.trim().toUpperCase() : ''
    const syncResult = await syncSquareLinkedOrders(db, env, { requestId, orderCode })
    if (syncResult.changedCount) {
      const syncedOrder = requestId
        ? await findOrderPairByRequestId(db, requestId).then((result) => result.request)
        : orderCode
          ? (await findOrderPairByOrderCode(db, orderCode)).order
          : null
      if (syncedOrder) {
        await recordOrderEvent(
          db,
          syncedOrder,
          'square_sync',
          {
            message: 'Square reconciliation ran manually.',
            details: `${syncResult.changedCount} order(s) updated.`,
          },
          { type: 'admin', name: 'priest', email: '', role: currentAdmin?.role || 'staff' },
        )
      }
    }

    sendJson(response, 200, {
      ok: true,
      message: syncResult.changedCount
        ? `Synced ${syncResult.changedCount} Square-linked order${syncResult.changedCount === 1 ? '' : 's'}.`
        : `Checked ${syncResult.syncedCount} Square-linked order${syncResult.syncedCount === 1 ? '' : 's'}. No changes found.`,
      ...syncResult,
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
