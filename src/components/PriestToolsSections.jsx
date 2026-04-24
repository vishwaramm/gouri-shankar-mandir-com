import { NavLink } from 'react-router-dom'
import { getOrderEventLabel } from '../lib/orderStatus.js'

function formatDateTime(value) {
  if (!value) return 'Unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleString()
}

function formatActionLabel(value) {
  const text = String(value || '')
    .replaceAll('_', ' ')
    .trim()

  if (!text) return 'Audit event'

  return text
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatMetadataSummary(metadata) {
  if (!metadata || typeof metadata !== 'object') return ''

  return Object.entries(metadata)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
    .join(' · ')
}

function getItemTimestamp(item = {}) {
  return item?.publishedAt || item?.updatedAt || item?.createdAt || ''
}

function countItemsSince(items = [], days = 30) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return items.filter((item) => {
    const time = new Date(getItemTimestamp(item)).getTime()
    return Number.isFinite(time) && time >= cutoff
  }).length
}

function countByField(items = [], field = 'service') {
  const counts = new Map()
  items.forEach((item) => {
    const key = String(item?.[field] || '').trim()
    if (!key) return
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  return [...counts.entries()]
    .sort((left, right) => Number(right[1] || 0) - Number(left[1] || 0))
    .slice(0, 5)
}

export function SquareSyncPanel({ syncStatus, syncBusy, syncMessage, onSync }) {
  return (
    <div className="surface surface-soft surface-pad mt-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <div className="section-kicker mb-2">Square sync</div>
          <div className="h5 mb-1">Webhook status and reconciliation</div>
          <p className="mb-0 text-secondary">
            Shows whether Square webhook settings are configured and whether recent Square events have been processed.
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <span className={`badge ${syncStatus.webhookConfigured ? 'text-bg-success' : 'text-bg-warning text-dark'}`}>
            {syncStatus.webhookConfigured ? 'Webhook configured' : 'Webhook not configured'}
          </span>
          <span className={`badge ${syncStatus.signatureConfigured ? 'text-bg-success' : 'text-bg-warning text-dark'}`}>
            {syncStatus.signatureConfigured ? 'Signature key set' : 'Signature key missing'}
          </span>
          <span className="badge text-bg-light border text-dark">{syncStatus.recentEvents} recent events</span>
          <button type="button" className="btn btn-outline-light btn-sm rounded-pill px-3" onClick={onSync} disabled={syncBusy}>
            {syncBusy ? 'Syncing...' : 'Sync from Square'}
          </button>
        </div>
      </div>
      <div className="row g-3 mt-3">
        <div className="col-md-6">
          <div className="surface surface-soft surface-pad h-100">
            <div className="small text-secondary">Webhook URL</div>
            <div className="fw-semibold text-break">{syncStatus.webhookUrl || 'Not configured'}</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="surface surface-soft surface-pad h-100">
            <div className="small text-secondary">Last event</div>
            <div className="fw-semibold">
              {syncStatus.lastEventAt ? new Date(syncStatus.lastEventAt).toLocaleString() : 'None yet'}
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="surface surface-soft surface-pad h-100">
            <div className="small text-secondary">Last type</div>
            <div className="fw-semibold">{syncStatus.lastEventType || 'None yet'}</div>
          </div>
        </div>
      </div>
      {syncMessage ? <p className="small text-secondary mt-3 mb-0">{syncMessage}</p> : null}
    </div>
  )
}

export function SiteAnalyticsPanel({
  orders = [],
  newsletters = [],
  rsvps = [],
  communityEvents = [],
  contactMessages = [],
  blogPosts = [],
  analytics = null,
}) {
  const requestEntries = orders.filter((item) => Boolean(item.requestId) && !item.donationId)
  const donationEntries = orders.filter((item) => Boolean(item.donationId))
  const snapshotTotals = analytics?.totals || {}
  const snapshotRecent = analytics?.recent30Days || {}
  const snapshotTopServices = Array.isArray(analytics?.topServices) ? analytics.topServices : []
  const requestCount = Number(snapshotTotals.requests ?? requestEntries.length)
  const supportCount = Number(
    snapshotTotals.supportRequests ??
      requestEntries.filter((item) => ['refund_requested', 'cancel_requested'].includes(item.serviceStatus)).length,
  )
  const completedCount = Number(
    snapshotTotals.completedRequests ??
      requestEntries.filter((item) => item.serviceStatus === 'completed' || item.serviceCompletedAt).length,
  )
  const newsletterCount = Number(snapshotTotals.newsletters ?? newsletters.length)
  const rsvpCount = Number(snapshotTotals.rsvps ?? rsvps.length)
  const contactCount = Number(snapshotTotals.contactMessages ?? contactMessages.length)
  const communityCount = Number(snapshotTotals.communityEvents ?? communityEvents.length)
  const blogPublishedCount = Number(
    snapshotTotals.blogApproved ??
      blogPosts.filter((item) => String(item.approvalStatus || 'approved') === 'approved').length,
  )
  const blogPendingCount = Number(
    snapshotTotals.blogPending ?? blogPosts.filter((item) => String(item.approvalStatus || '') === 'pending').length,
  )
  const last30Days = [
    { label: 'Service requests', count: Number(snapshotRecent.requests ?? countItemsSince(requestEntries, 30)) },
    { label: 'Payments', count: Number(snapshotRecent.donations ?? countItemsSince(donationEntries, 30)) },
    { label: 'Contact messages', count: Number(snapshotRecent.contactMessages ?? countItemsSince(contactMessages, 30)) },
    { label: 'Temple letters', count: Number(snapshotRecent.newsletters ?? countItemsSince(newsletters, 30)) },
    { label: 'RSVPs', count: Number(snapshotRecent.rsvps ?? countItemsSince(rsvps, 30)) },
    { label: 'Community events', count: Number(snapshotRecent.communityEvents ?? countItemsSince(communityEvents, 30)) },
    { label: 'Blog posts', count: Number(snapshotRecent.blogPosts ?? countItemsSince(blogPosts, 30)) },
  ]
  const topServices = snapshotTopServices.length
    ? snapshotTopServices
    : countByField(requestEntries, 'service').map(([service, count]) => ({
        service,
        count: Number(count || 0),
      }))

  const topWindow = Math.max(
    1,
    ...last30Days.map((item) => Number(item.count || 0)),
    ...topServices.map(([, count]) => Number(count || 0)),
  )

  return (
    <div className="surface surface-pad mt-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <div className="section-kicker mb-2">Analytics</div>
          <div className="h5 mb-1">Live site activity</div>
          <p className="mb-0 text-secondary">
            Real counts from requests, inbox traffic, RSVPs, blog posts, and community events.
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <span className="badge text-bg-light border text-dark">{requestCount} requests</span>
          <span className="badge text-bg-light border text-dark">{contactCount} messages</span>
          <span className="badge text-bg-light border text-dark">{newsletterCount} subscribers</span>
        </div>
      </div>

      <div className="row g-3 mt-3">
        <div className="col-6 col-lg-3">
          <div className="surface surface-soft surface-pad h-100">
            <div className="small text-secondary">Service requests</div>
            <div className="h4 mb-0">{requestCount}</div>
            <div className="small text-secondary mt-1">{supportCount} open support cases</div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="surface surface-soft surface-pad h-100">
            <div className="small text-secondary">Completed services</div>
            <div className="h4 mb-0">{completedCount}</div>
            <div className="small text-secondary mt-1">From all tracked orders</div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="surface surface-soft surface-pad h-100">
            <div className="small text-secondary">Blog</div>
            <div className="h4 mb-0">{blogPublishedCount}</div>
            <div className="small text-secondary mt-1">{blogPendingCount} pending approval</div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="surface surface-soft surface-pad h-100">
            <div className="small text-secondary">Community</div>
            <div className="h4 mb-0">{communityCount}</div>
            <div className="small text-secondary mt-1">{rsvpCount} RSVPs</div>
          </div>
        </div>
      </div>

      <div className="row g-3 mt-3">
        <div className="col-lg-7">
          <div className="surface surface-soft surface-pad h-100">
            <div className="section-kicker mb-2">Recent activity</div>
            <div className="d-grid gap-3">
              {last30Days.map((item) => {
                const width = Math.max(8, Math.round((Number(item.count || 0) / topWindow) * 100))
                return (
                  <div key={item.label}>
                    <div className="d-flex justify-content-between align-items-center gap-3 mb-1">
                      <div className="fw-semibold">{item.label}</div>
                      <div className="small text-secondary">{item.count} in 30 days</div>
                    </div>
                    <div className="progress" style={{ height: '8px' }}>
                      <div className="progress-bar bg-primary" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="surface surface-soft surface-pad h-100">
            <div className="section-kicker mb-2">Top services</div>
            <div className="d-grid gap-3">
              {topServices.length ? (
                topServices.map((serviceEntry) => {
                  const service = serviceEntry.service || serviceEntry[0] || 'Service'
                  const count = Number(serviceEntry.count ?? serviceEntry[1] ?? 0)
                  const width = Math.max(8, Math.round((Number(count || 0) / topWindow) * 100))
                  return (
                    <div key={service}>
                      <div className="d-flex justify-content-between align-items-center gap-3 mb-1">
                        <div className="fw-semibold text-break">{service}</div>
                        <div className="small text-secondary">{count}</div>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div className="progress-bar bg-info" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="small text-secondary">No service requests yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function OrderEventLogPanel({ events = [] }) {
  return (
    <div className="surface surface-pad mt-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <div className="section-kicker mb-2">Audit log</div>
          <div className="h5 mb-1">Recent order activity</div>
          <p className="mb-0 text-secondary">The latest event stream across requests, payments, completions, and Square sync.</p>
        </div>
        <span className="badge text-bg-light border text-dark">{events.length} events</span>
      </div>
      <div className="timeline-list mt-3">
        {events.length ? (
          events.map((event) => (
            <article className="timeline-item" key={event.eventId}>
              <time>{formatDateTime(event.createdAt)}</time>
              <div>
                <h4 className="h5 mb-1">{getOrderEventLabel(event.eventType)}</h4>
                <p className="mb-0 text-secondary">
                  {event.message || event.details || 'Order update recorded.'}
                  {event.orderCode ? ` · ${event.orderCode}` : ''}
                  {event.actorName ? ` · ${event.actorName}` : ''}
                  {event.actorRole ? ` · ${event.actorRole}` : ''}
                </p>
              </div>
            </article>
          ))
        ) : (
          <div className="surface surface-soft surface-pad">No recent order activity.</div>
        )}
      </div>
    </div>
  )
}

export function AdminAccessRequestsPanel({ requests = [] }) {
  const pendingRequests = requests.filter((request) => request.status === 'pending')
  return (
    <div className="surface surface-pad mt-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <div className="section-kicker mb-2">Admin approvals</div>
          <div className="h5 mb-1">Pending access requests</div>
          <p className="mb-0 text-secondary">
            These requests are waiting for approval by the temple admins via email link.
          </p>
        </div>
        <span className="badge text-bg-light border text-dark">{pendingRequests.length} pending</span>
      </div>
      <div className="timeline-list mt-3">
        {pendingRequests.length ? (
          pendingRequests.map((request) => (
            <article className="timeline-item" key={request.id}>
              <time>{formatDateTime(request.createdAt)}</time>
              <div>
                <h4 className="h5 mb-1">{request.name || 'Admin request'}</h4>
                <p className="mb-0 text-secondary">
                  {request.email}
                  {request.expiresAt ? ` · expires ${formatDateTime(request.expiresAt)}` : ''}
                </p>
              </div>
            </article>
          ))
        ) : (
          <div className="surface surface-soft surface-pad">No pending admin requests.</div>
        )}
      </div>
    </div>
  )
}

export function TempleLettersPanel({ subscribers = [] }) {
  const sortedSubscribers = [...subscribers].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))

  return (
    <div className="surface surface-pad mt-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <div className="section-kicker mb-2">Temple letters</div>
          <div className="h5 mb-1">Newsletter subscribers</div>
          <p className="mb-0 text-secondary">People who signed up for temple letters and announcements.</p>
        </div>
        <span className="badge text-bg-light border text-dark">{sortedSubscribers.length} subscribers</span>
      </div>

      <div className="timeline-list mt-3">
        {sortedSubscribers.length ? (
          sortedSubscribers.map((subscriber) => (
            <article className="timeline-item" key={subscriber.email}>
              <time>{formatDateTime(subscriber.createdAt)}</time>
              <div>
                <h4 className="h5 mb-1">{subscriber.email}</h4>
                <p className="mb-0 text-secondary">Subscribed for temple letters.</p>
              </div>
            </article>
          ))
        ) : (
          <div className="surface surface-soft surface-pad">No temple letters subscribers yet.</div>
        )}
      </div>
    </div>
  )
}

export function CommunityRsvpsPanel({ rsvps = [] }) {
  const sortedRsvps = [...rsvps].sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))

  return (
    <div className="surface surface-pad mt-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <div className="section-kicker mb-2">Community RSVPs</div>
          <div className="h5 mb-1">Event responses</div>
          <p className="mb-0 text-secondary">Member RSVP records linked to accounts and community events.</p>
        </div>
        <span className="badge text-bg-light border text-dark">{sortedRsvps.length} responses</span>
      </div>

      <div className="timeline-list mt-3">
        {sortedRsvps.length ? (
          sortedRsvps.map((rsvp) => (
            <article className="timeline-item" key={rsvp.id || `${rsvp.eventId}-${rsvp.userId}-${rsvp.createdAt}`}>
              <time>{formatDateTime(rsvp.updatedAt || rsvp.createdAt)}</time>
              <div>
                <h4 className="h5 mb-1">{rsvp.eventTitle || 'Community event'}</h4>
                <p className="mb-1 text-secondary">
                  {rsvp.userName || 'Member'}
                  {rsvp.email ? ` · ${rsvp.email}` : ''}
                  {rsvp.guestCount ? ` · ${rsvp.guestCount} guest${rsvp.guestCount === 1 ? '' : 's'}` : ''}
                </p>
                <p className="mb-1">{rsvp.note || 'RSVP saved.'}</p>
                <p className="mb-0 text-secondary">
                  {rsvp.eventDate ? `Date: ${rsvp.eventDate}` : 'Date not set'}
                  {rsvp.section ? ` · Section: ${rsvp.section}` : ''}
                  {rsvp.kind ? ` · ${rsvp.kind}` : ''}
                </p>
              </div>
            </article>
          ))
        ) : (
          <div className="surface surface-soft surface-pad">No RSVPs yet.</div>
        )}
      </div>
    </div>
  )
}

export function AdminAuditLogPanel({ events = [] }) {
  const sortedEvents = [...events].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))

  return (
    <div className="surface surface-pad mt-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <div className="section-kicker mb-2">Audit trail</div>
          <div className="h5 mb-1">Admin activity</div>
          <p className="mb-0 text-secondary">Recent title changes, blog actions, community edits, and inbox actions.</p>
        </div>
        <span className="badge text-bg-light border text-dark">{sortedEvents.length} events</span>
      </div>

      <div className="timeline-list mt-3">
        {sortedEvents.length ? (
          sortedEvents.map((event) => (
            <article className="timeline-item" key={event.id || `${event.action}-${event.createdAt}`}>
              <time>{formatDateTime(event.createdAt)}</time>
              <div>
                <h4 className="h5 mb-1">{formatActionLabel(event.action)}</h4>
                <p className="mb-1 text-secondary">
                  {event.actorName || 'Admin'}
                  {event.actorEmail ? ` · ${event.actorEmail}` : ''}
                  {event.actorRole ? ` · ${event.actorRole}` : ''}
                </p>
                <p className="mb-1">{event.details || 'Action recorded.'}</p>
                <p className="mb-0 text-secondary">
                  {event.targetLabel ? `Target: ${event.targetLabel}` : null}
                  {event.targetLabel && event.targetType ? ' · ' : null}
                  {event.targetType ? `Type: ${event.targetType}` : null}
                </p>
                {formatMetadataSummary(event.metadata) ? (
                  <p className="mb-0 small text-secondary">{formatMetadataSummary(event.metadata)}</p>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="surface surface-soft surface-pad">No admin audit events yet.</div>
        )}
      </div>
    </div>
  )
}

export function ClientErrorLogPanel({ errors = [] }) {
  const sortedErrors = [...errors].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))

  return (
    <div className="surface surface-pad mt-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <div className="section-kicker mb-2">Client errors</div>
          <div className="h5 mb-1">Captured browser issues</div>
          <p className="mb-0 text-secondary">Unhandled JavaScript errors and promise rejections reported by visitors and admins.</p>
        </div>
        <span className="badge text-bg-light border text-dark">{sortedErrors.length} errors</span>
      </div>

      <div className="timeline-list mt-3">
        {sortedErrors.length ? (
          sortedErrors.map((error) => (
            <article className="timeline-item" key={error.id || `${error.createdAt}-${error.message}`}>
              <time>{formatDateTime(error.createdAt)}</time>
              <div>
                <h4 className="h5 mb-1">{error.message || 'Browser error'}</h4>
                <p className="mb-1 text-secondary">
                  {error.source || 'window.error'}
                  {error.pageUrl ? ` · ${error.pageUrl}` : ''}
                </p>
                <p className="mb-1">
                  {error.filename ? error.filename : 'No filename'}
                  {Number.isInteger(error.lineNumber) ? `:${error.lineNumber}` : ''}
                  {Number.isInteger(error.columnNumber) ? `:${error.columnNumber}` : ''}
                </p>
                {error.stack ? (
                  <pre className="mb-0 small text-secondary" style={{ whiteSpace: 'pre-wrap' }}>
                    {error.stack}
                  </pre>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="surface surface-soft surface-pad">No client errors captured yet.</div>
        )}
      </div>
    </div>
  )
}

function formatBytes(value = 0) {
  const size = Number(value) || 0
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let current = size
  let unitIndex = 0

  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024
    unitIndex += 1
  }

  return `${current.toFixed(current >= 100 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function getSeverityBadgeClass(severity = 'warning') {
  if (severity === 'critical') return 'text-bg-danger'
  if (severity === 'info') return 'text-bg-info'
  return 'text-bg-warning text-dark'
}

export function ApiMetricsPanel({
  metrics = null,
  onRefresh,
  refreshBusy = false,
  refreshError = '',
  onResolveAlert,
  resolvingAlertIds = {},
}) {
  const snapshot = metrics?.metrics || {}
  const runtime = metrics?.runtime || {}
  const serviceState = metrics?.serviceState || {}
  const alerts = metrics?.alerts || { open: [], recent: [] }
  const statusCounts = Array.isArray(snapshot.statusCounts) ? snapshot.statusCounts : []
  const routes = Array.isArray(snapshot.routes) ? snapshot.routes : []
  const recentErrors = Array.isArray(snapshot.recentErrors) ? snapshot.recentErrors : []
  const openAlerts = Array.isArray(alerts.open) ? alerts.open : []

  const topStatusCount = Math.max(...statusCounts.map((item) => Number(item.count || 0)), 1)
  const topRouteCount = Math.max(...routes.map((item) => Number(item.count || 0)), 1)

  return (
    <div className="surface surface-pad mt-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <div className="section-kicker mb-2">Metrics</div>
          <div className="h5 mb-1">Operational overview</div>
          <p className="mb-0 text-secondary">Request volume, latency, runtime memory, and active alert state.</p>
        </div>
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <span className={`badge ${serviceState.strictPersistence ? 'text-bg-success' : 'text-bg-warning text-dark'}`}>
            {serviceState.strictPersistence ? 'Strict persistence' : 'Flexible storage'}
          </span>
          <span className={`badge ${serviceState.databaseStatus === 'connected' ? 'text-bg-success' : 'text-bg-warning text-dark'}`}>
            {serviceState.databaseStatus || 'unknown'}
          </span>
          <span className="badge text-bg-light border text-dark">{snapshot?.totals?.requests || 0} requests</span>
          {onRefresh ? (
            <button
              type="button"
              className="btn btn-outline-light btn-sm rounded-pill px-3"
              disabled={refreshBusy}
              onClick={onRefresh}
            >
              {refreshBusy ? 'Refreshing...' : 'Refresh metrics'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="row g-3 mt-3">
        <div className="col-6 col-lg-3">
          <div className="surface surface-soft surface-pad h-100">
            <div className="small text-secondary">Average latency</div>
            <div className="h4 mb-0">{snapshot?.durations?.averageMs || 0} ms</div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="surface surface-soft surface-pad h-100">
            <div className="small text-secondary">Peak latency</div>
            <div className="h4 mb-0">{snapshot?.durations?.maxMs || 0} ms</div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="surface surface-soft surface-pad h-100">
            <div className="small text-secondary">5xx errors</div>
            <div className="h4 mb-0">{snapshot?.totals?.serverErrors || 0}</div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="surface surface-soft surface-pad h-100">
            <div className="small text-secondary">Memory</div>
            <div className="h4 mb-0">{formatBytes(runtime?.memoryUsage?.rss || 0)}</div>
          </div>
        </div>
      </div>
      {refreshError ? <p className="small text-danger mt-3 mb-0">{refreshError}</p> : null}

      <div className="row g-3 mt-3">
        <div className="col-lg-5">
          <div className="surface surface-soft surface-pad h-100">
            <div className="section-kicker mb-2">Status codes</div>
            <div className="d-grid gap-2">
              {statusCounts.length ? (
                statusCounts.map((item) => {
                  const width = Math.max(6, Math.round((Number(item.count || 0) / topStatusCount) * 100))
                  return (
                    <div key={item.statusCode} className="d-flex align-items-center gap-3">
                      <div style={{ minWidth: '52px' }} className="small fw-semibold">
                        {item.statusCode}
                      </div>
                      <div className="flex-grow-1">
                        <div className="progress" style={{ height: '8px' }}>
                          <div className={`progress-bar ${String(item.statusCode).startsWith('5') ? 'bg-danger' : String(item.statusCode).startsWith('4') ? 'bg-warning' : 'bg-success'}`} style={{ width: `${width}%` }} />
                        </div>
                      </div>
                      <div className="small text-secondary" style={{ minWidth: '48px', textAlign: 'right' }}>
                        {item.count}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="small text-secondary">No status codes recorded yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-7">
          <div className="surface surface-soft surface-pad h-100">
            <div className="section-kicker mb-2">Top routes</div>
            <div className="d-grid gap-3">
              {routes.length ? (
                routes.slice(0, 6).map((route) => {
                  const width = Math.max(6, Math.round((Number(route.count || 0) / topRouteCount) * 100))
                  return (
                    <div key={route.route}>
                      <div className="d-flex justify-content-between align-items-center gap-3 mb-1">
                        <div className="fw-semibold text-break">{route.route}</div>
                        <div className="small text-secondary">
                          {route.count} req · avg {route.averageDurationMs || 0} ms
                        </div>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div className="progress-bar bg-primary" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="small text-secondary">No route metrics yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mt-3">
        <div className="col-lg-6">
          <div className="surface surface-soft surface-pad h-100">
            <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
              <div className="section-kicker">Open alerts</div>
              <span className="badge text-bg-light border text-dark">{openAlerts.length}</span>
            </div>
            <div className="timeline-list">
              {openAlerts.length ? (
                openAlerts.map((alert) => (
                  <article className="timeline-item" key={alert.id}>
                    <time>{formatDateTime(alert.lastSeenAt || alert.createdAt)}</time>
                    <div>
                      <h4 className="h5 mb-1">{alert.title || 'Alert'}</h4>
                      <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
                        <span className={`badge ${getSeverityBadgeClass(alert.severity)}`}>{alert.severity || 'warning'}</span>
                        <span className="badge text-bg-light border text-dark">{alert.occurrenceCount || 1} hits</span>
                      </div>
                      <p className="mb-2 text-secondary">{alert.message || 'Alert triggered.'}</p>
                      <div className="d-flex flex-wrap gap-2 align-items-center">
                        {onResolveAlert ? (
                          <button
                            type="button"
                            className="btn btn-outline-light btn-sm rounded-pill px-3"
                            disabled={Boolean(resolvingAlertIds?.[alert.id])}
                            onClick={() => onResolveAlert(alert)}
                          >
                            {resolvingAlertIds?.[alert.id] ? 'Resolving...' : 'Resolve'}
                          </button>
                        ) : null}
                        <span className="small text-secondary">
                          {alert.details && typeof alert.details === 'object'
                            ? Object.entries(alert.details)
                                .map(([key, value]) => `${key}: ${value}`)
                                .join(' · ')
                            : ''}
                        </span>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="surface surface-soft surface-pad">No open alerts.</div>
              )}
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="surface surface-soft surface-pad h-100">
            <div className="section-kicker mb-2">Recent errors</div>
            <div className="timeline-list">
              {recentErrors.length ? (
                recentErrors.slice(0, 6).map((error) => (
                  <article className="timeline-item" key={`${error.requestId}-${error.createdAt}`}>
                    <time>{formatDateTime(error.createdAt)}</time>
                    <div>
                      <h4 className="h5 mb-1">{error.method} {error.route}</h4>
                      <p className="mb-1 text-secondary">
                        {error.statusCode} · {error.durationMs || 0} ms{error.aborted ? ' · aborted' : ''}
                      </p>
                      <p className="mb-0">{error.errorMessage || 'Request error'}</p>
                    </div>
                  </article>
                ))
              ) : (
                <div className="surface surface-soft surface-pad">No recent request errors.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ContactMessagesPanel({
  messages = [],
  currentOfficerId = '',
  replyDrafts = {},
  replyBusyById = {},
  replyStatusById = {},
  deleteBusyById = {},
  deleteStatusById = {},
  readBusyById = {},
  readStatusById = {},
  onReplyDraftChange,
  onMarkRead,
  onReply,
  onDelete,
}) {
  const unreadCount = messages.filter((message) => {
    const readIds = Array.isArray(message.readByOfficerIds) ? message.readByOfficerIds : []
    return currentOfficerId ? !readIds.includes(currentOfficerId) : false
  }).length

  return (
    <div className="surface surface-pad mt-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <div className="section-kicker mb-2">Inbox</div>
          <div className="h5 mb-1">Contact messages</div>
          <p className="mb-0 text-secondary">
            Messages sent from the site arrive here for the officers who were selected or for all officers in the temple.
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <span className="badge text-bg-light border text-dark">{messages.length} messages</span>
          <span className="badge text-bg-warning text-dark">{unreadCount} unread</span>
        </div>
      </div>

      <div className="row g-3 mt-3">
        {messages.length ? (
          messages.map((message) => {
            const recipientNames = Array.isArray(message.recipientOfficerNames) && message.recipientOfficerNames.length
              ? message.recipientOfficerNames.join(', ')
              : 'All officers'
            const replyDraft = replyDrafts[message.id] || ''
            const readIds = Array.isArray(message.readByOfficerIds) ? message.readByOfficerIds : []
            const isUnread = currentOfficerId ? !readIds.includes(currentOfficerId) : false

            return (
              <div className="col-12" key={message.id}>
                <article className="surface surface-soft surface-pad">
                  <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
                    <div>
                      <p className="section-kicker mb-2">{message.subject || 'General message'}</p>
                      <h3 className="h5 mb-1">{message.name || 'Visitor'}</h3>
                      <p className="mb-0 text-secondary">
                        {message.email}
                        {message.phone ? ` · ${message.phone}` : ''}
                      </p>
                    </div>
                    <div className="text-end">
                      <span className="badge text-bg-light border text-dark">To: {recipientNames}</span>
                      <div className="mt-2 d-flex flex-column align-items-end gap-2">
                        <span className={`badge ${isUnread ? 'text-bg-warning text-dark' : 'text-bg-success'}`}>
                          {isUnread ? 'Unread' : 'Read'}
                        </span>
                        {message.repliedAt ? <div className="small text-success-emphasis">Replied</div> : null}
                      </div>
                    </div>
                  </div>

                  <div className="surface surface-soft surface-pad mt-3">
                    <div className="small text-secondary">Message</div>
                    <div className="mt-1" style={{ whiteSpace: 'pre-wrap' }}>
                      {message.message || 'No message provided.'}
                    </div>
                    <div className="small text-secondary mt-3">Received</div>
                    <div>{formatDateTime(message.createdAt)}</div>
                  </div>

                  {message.repliedAt ? (
                    <div className="surface surface-soft surface-pad mt-3">
                      <div className="small text-secondary">Reply</div>
                      <div className="fw-semibold mt-1">{message.replySubject || 'Reply sent'}</div>
                      <div className="small text-secondary mt-2">Sent</div>
                      <div>{formatDateTime(message.replyEmailSentAt || message.repliedAt)}</div>
                      <div className="mt-2" style={{ whiteSpace: 'pre-wrap' }}>
                        {message.replyMessage || 'No reply text saved.'}
                      </div>
                    </div>
                  ) : null}

                  <div className="surface surface-strong surface-pad mt-3">
                    <label className="form-label fw-semibold text-primary-emphasis">Reply</label>
                    <textarea
                      className="form-control"
                      rows="4"
                      value={replyDraft}
                      onChange={(event) => onReplyDraftChange?.(message.id, event.target.value)}
                      placeholder="Write the reply that should be emailed to the visitor."
                    />
                    <div className="d-flex flex-wrap gap-3 align-items-center mt-3">
                      {isUnread ? (
                        <button
                          type="button"
                          className="btn btn-outline-light rounded-pill px-4"
                          disabled={Boolean(readBusyById[message.id])}
                          onClick={() => onMarkRead?.(message)}
                        >
                          {readBusyById[message.id] ? 'Marking...' : 'Mark read'}
                        </button>
                      ) : (
                        <span className="small text-success-emphasis">Already read</span>
                      )}
                      <button
                        type="button"
                        className="btn btn-primary rounded-pill px-4"
                        disabled={Boolean(replyBusyById[message.id])}
                        onClick={() => onReply?.(message)}
                      >
                        {replyBusyById[message.id] ? 'Sending...' : 'Send reply'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-light rounded-pill px-4"
                        disabled={Boolean(deleteBusyById[message.id])}
                        onClick={() => onDelete?.(message)}
                      >
                        {deleteBusyById[message.id] ? 'Removing...' : 'Delete from my inbox'}
                      </button>
                      <div className="small text-secondary">
                        {readStatusById[message.id] || replyStatusById[message.id] || deleteStatusById[message.id] || ''}
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            )
          })
        ) : (
          <div className="col-12">
            <div className="surface surface-soft surface-pad">No contact messages yet.</div>
          </div>
        )}
      </div>
    </div>
  )
}

export function SupportRequestCard({
  request,
  supportLabel,
  refundBusy,
  cancellationBusy,
  refundStatus,
  cancellationStatus,
  orderSyncBusy,
  orderSyncStatus,
  onOpenRecord,
  onProcessRefund,
  onProcessCancellation,
  onSyncOrder,
}) {
  return (
    <div className="col-12 col-lg-6" key={`support-${request.id || `${request.createdAt}-${request.email}`}`}>
      <div className="surface surface-pad h-100">
        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
          <div>
            <p className="section-kicker mb-2">{request.service}</p>
            <h3 className="h5 mb-1">{request.name}</h3>
            <p className="mb-0 text-secondary">
              {request.email}
              {request.phone ? ` · ${request.phone}` : ''}
            </p>
          </div>
          <div className="text-end">
            <span className="badge text-bg-warning text-dark">{supportLabel}</span>
          </div>
        </div>

        <div className="surface surface-soft surface-pad mb-3">
          <div className="small text-secondary">Requested</div>
          <div className="fw-semibold">{formatDateTime(request.supportRequestedAt)}</div>
          <div className="small text-secondary mt-2">Reason</div>
          <div>{request.supportRequestReason || 'No reason provided.'}</div>
        </div>

        <div className="d-flex flex-wrap gap-3 align-items-center">
          <button type="button" className="btn btn-outline-light rounded-pill px-4" onClick={onOpenRecord}>
            Open record
          </button>
          {request.serviceStatus === 'refund_requested' && !request.refundedAt ? (
            <button
              type="button"
              className="btn btn-primary rounded-pill px-4"
              onClick={onProcessRefund}
              disabled={refundBusy}
            >
              {refundBusy ? 'Refunding...' : 'Process refund'}
            </button>
          ) : request.serviceStatus === 'cancel_requested' ? (
            <button
              type="button"
              className="btn btn-primary rounded-pill px-4"
              onClick={onProcessCancellation}
              disabled={cancellationBusy}
            >
              {cancellationBusy ? 'Resolving...' : 'Mark cancelled'}
            </button>
          ) : null}
          <button type="button" className="btn btn-outline-light rounded-pill px-4" onClick={onSyncOrder} disabled={orderSyncBusy}>
            {orderSyncBusy ? 'Syncing...' : 'Sync from Square'}
          </button>
        </div>

        {cancellationStatus ? <p className="small text-secondary mt-3 mb-0">{cancellationStatus}</p> : null}
        {refundStatus ? <p className="small text-secondary mt-3 mb-0">{refundStatus}</p> : null}
        {orderSyncStatus ? <p className="small text-secondary mt-3 mb-0">{orderSyncStatus}</p> : null}
      </div>
    </div>
  )
}

export function ServiceRequestCard({
  request,
  completionBusy,
  refundBusy,
  completionStatus,
  refundStatus,
  orderSyncBusy,
  orderSyncStatus,
  onMarkComplete,
  onProcessRefund,
  onSyncOrder,
}) {
  return (
    <div className="col-12 col-xl-6" key={request.id || `${request.createdAt}-${request.email}`}>
      <div className="surface surface-pad h-100">
        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
          <div>
            <p className="section-kicker mb-2">{request.service}</p>
            <h3 className="h5 mb-1">{request.name}</h3>
            <p className="mb-0 text-secondary">
              {request.email}
              {request.phone ? ` · ${request.phone}` : ''}
            </p>
          </div>
          <div className="text-end">
            {request.serviceStatus === 'cancelled' || request.cancelledAt ? (
              <span className="badge text-bg-dark">Cancelled</span>
            ) : request.serviceStatus === 'refund_requested' ? (
              <span className="badge text-bg-warning text-dark">Refund requested</span>
            ) : request.serviceStatus === 'cancel_requested' ? (
              <span className="badge text-bg-warning text-dark">Cancellation requested</span>
            ) : request.serviceCompletedAt ? (
              <span className="badge text-bg-primary">Completed</span>
            ) : request.paymentReceivedAt ? (
              <span className="badge text-bg-success">Paid</span>
            ) : request.paymentPageSentAt ? (
              <span className="badge text-bg-success">Sent</span>
            ) : (
              <span className="badge text-bg-secondary">Pending</span>
            )}
          </div>
        </div>

        <div className="row g-3">
          <div className="col-md-6">
            <div className="surface surface-soft surface-pad h-100">
              <div className="section-kicker mb-2">Request</div>
              <div className="small text-secondary">Date</div>
              <div className="mb-2">{request.date || 'Not selected'}</div>
              <div className="small text-secondary">Created</div>
              <div>{request.createdAt ? new Date(request.createdAt).toLocaleString() : 'Unknown'}</div>
              <div className="small text-secondary mt-2">Target completion</div>
              <div>
                {request.scheduledFor ? new Date(`${request.scheduledFor}T12:00:00`).toLocaleDateString() : 'Pending'}
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="surface surface-soft surface-pad h-100">
              <div className="section-kicker mb-2">Intention</div>
              <p className="mb-0">{request.note}</p>
            </div>
          </div>
        </div>

        <div className="d-flex flex-wrap gap-3 align-items-center mt-3">
          <NavLink
            className="btn btn-outline-light rounded-pill px-4"
            to={`/priest-payment-request?requestId=${encodeURIComponent(request.id || '')}`}
          >
            Open payment request
          </NavLink>
          <NavLink
            className="btn btn-link px-0 text-decoration-none"
            to={`/priest-custom-payment?name=${encodeURIComponent(request.name || '')}&email=${encodeURIComponent(
              request.email || '',
            )}&phone=${encodeURIComponent(request.phone || '')}`}
          >
            Open custom payment
          </NavLink>
          {request.serviceStatus === 'refund_requested' && !request.refundedAt ? (
            <button
              type="button"
              className="btn btn-outline-primary rounded-pill px-4"
              onClick={onProcessRefund}
              disabled={refundBusy}
            >
              {refundBusy ? 'Refunding...' : 'Process refund'}
            </button>
          ) : request.paymentReceivedAt && !request.serviceCompletedAt ? (
            <button
              type="button"
              className="btn btn-primary rounded-pill px-4"
              onClick={onMarkComplete}
              disabled={completionBusy}
            >
              {completionBusy ? 'Marking...' : 'Mark complete'}
            </button>
          ) : null}
          <button type="button" className="btn btn-outline-light rounded-pill px-4" onClick={onSyncOrder} disabled={orderSyncBusy}>
            {orderSyncBusy ? 'Syncing...' : 'Sync from Square'}
          </button>
        </div>
        {completionStatus ? <p className="small text-secondary mt-3 mb-0">{completionStatus}</p> : null}
        {refundStatus ? <p className="small text-secondary mt-3 mb-0">{refundStatus}</p> : null}
        {orderSyncStatus ? <p className="small text-secondary mt-3 mb-0">{orderSyncStatus}</p> : null}
      </div>
    </div>
  )
}
