const STORAGE_KEY = 'gourishankar-pending-submissions-v1'
const QUEUE_EVENT = 'gourishankar-pending-submissions-updated'

function getStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function notifyQueueChange() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(QUEUE_EVENT))
}

function safeParseQueue(rawValue) {
  if (!rawValue) return []

  try {
    const parsed = JSON.parse(rawValue)
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === 'object') : []
  } catch {
    return []
  }
}

export function loadPendingSubmissions() {
  const storage = getStorage()
  if (!storage) return []
  return safeParseQueue(storage.getItem(STORAGE_KEY))
}

export function savePendingSubmissions(entries = []) {
  const storage = getStorage()
  if (!storage) return []

  const nextEntries = Array.isArray(entries) ? entries.filter((item) => item && typeof item === 'object') : []
  storage.setItem(STORAGE_KEY, JSON.stringify(nextEntries))
  notifyQueueChange()
  return nextEntries
}

export function createSubmissionKey(prefix = 'submission') {
  const normalizedPrefix = String(prefix || 'submission').trim().replace(/[^a-z0-9-]+/gi, '-').toLowerCase() || 'submission'

  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${normalizedPrefix}-${crypto.randomUUID()}`
  }

  return `${normalizedPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function isRetryableSubmissionError(error) {
  if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) return true
  if (Number.isInteger(error?.status)) {
    return error.status >= 500
  }
  const message = String(error?.message || error || '').toLowerCase()
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network error') ||
    message.includes('load failed') ||
    message.includes('internet connection appears to be offline') ||
    message.includes('offline')
  )
}

export function queuePendingSubmission(entry) {
  if (!entry || typeof entry !== 'object') return []

  const nextEntry = {
    id: entry.id || createSubmissionKey(entry.kind || 'submission'),
    kind: String(entry.kind || 'submission').trim() || 'submission',
    submissionKey: String(entry.submissionKey || '').trim() || createSubmissionKey(entry.kind || 'submission'),
    payload: entry.payload && typeof entry.payload === 'object' ? entry.payload : {},
    createdAt: entry.createdAt || new Date().toISOString(),
    updatedAt: entry.updatedAt || new Date().toISOString(),
    attempts: Number.isInteger(entry.attempts) ? entry.attempts : 0,
    label: String(entry.label || '').trim(),
  }

  const current = loadPendingSubmissions()
  const next = [
    nextEntry,
    ...current.filter((item) => item.id !== nextEntry.id && item.submissionKey !== nextEntry.submissionKey),
  ]

  return savePendingSubmissions(next)
}

export function removePendingSubmission(entryId) {
  const current = loadPendingSubmissions()
  const next = current.filter((item) => item.id !== entryId)
  return savePendingSubmissions(next)
}

export async function flushPendingSubmissions(handlers = {}) {
  const current = loadPendingSubmissions()
  if (!current.length) return { processed: 0, remaining: 0, results: [] }
  if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) {
    return { processed: 0, remaining: current.length, results: [] }
  }

  const remaining = []
  const results = []

  for (const entry of [...current].sort((left, right) => String(left.createdAt || '').localeCompare(String(right.createdAt || '')))) {
    const handler = handlers?.[entry.kind]
    if (typeof handler !== 'function') {
      remaining.push(entry)
      continue
    }

    try {
      const result = await handler(entry)
      results.push({ entry, result: result || null })
      if (result?.keepQueued) {
        remaining.push({
          ...entry,
          attempts: (Number(entry.attempts) || 0) + 1,
          updatedAt: new Date().toISOString(),
        })
      }
    } catch (error) {
      results.push({ entry, error })
      if (isRetryableSubmissionError(error)) {
        remaining.push({
          ...entry,
          attempts: (Number(entry.attempts) || 0) + 1,
          updatedAt: new Date().toISOString(),
          lastError: String(error?.message || error || ''),
        })
        break
      }
    }
  }

  savePendingSubmissions(remaining)
  return {
    processed: current.length - remaining.length,
    remaining: remaining.length,
    results,
  }
}

export function subscribePendingSubmissionChanges(callback) {
  if (typeof window === 'undefined' || typeof callback !== 'function') return () => {}
  const handler = () => callback(loadPendingSubmissions())
  window.addEventListener(QUEUE_EVENT, handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener(QUEUE_EVENT, handler)
    window.removeEventListener('storage', handler)
  }
}
