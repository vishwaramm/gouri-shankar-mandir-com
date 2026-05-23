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

function formatMetricCount(value) {
  const number = Number(value || 0)
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(number >= 10_000_000 ? 0 : 1)}M`
  if (number >= 1_000) return `${(number / 1_000).toFixed(number >= 10_000 ? 0 : 1)}K`
  return `${number}`
}

function buildPolylinePoints(values = [], width = 100, height = 36, padding = 4) {
  const series = values.map((value) => Math.max(0, Number(value || 0)))
  const max = Math.max(1, ...series)
  if (!series.length) return ''
  if (series.length === 1) {
    const y = height - padding - ((series[0] / max) * (height - padding * 2))
    return `${padding},${y} ${width - padding},${y}`
  }

  return series
    .map((value, index) => {
      const x = padding + ((width - padding * 2) * index) / (series.length - 1)
      const y = height - padding - ((value / max) * (height - padding * 2))
      return `${x},${y}`
    })
    .join(' ')
}

function LineChart({ series = [], stroke = '#0d6efd', height = 180, label = '' }) {
  const values = series.map((item) => Number(item || 0))
  const safeHeight = Math.max(120, height)
  const max = Math.max(1, ...values)
  const pathPoints = buildPolylinePoints(values, 100, 36, 6)

  if (!values.length) {
    return <div className="small text-secondary">{label || 'No data yet.'}</div>
  }

  const areaPath = (() => {
    const points = values.map((value, index) => {
      const x = 6 + ((100 - 12) * index) / Math.max(1, values.length - 1)
      const y = 36 - 6 - ((value / max) * (36 - 12))
      return [x, y]
    })
    const first = points[0]
    const last = points[points.length - 1]
    return `M ${first[0]} ${36 - 6} L ${first[0]} ${first[1]} ${points
      .slice(1)
      .map(([x, y]) => `L ${x} ${y}`)
      .join(' ')} L ${last[0]} ${36 - 6} Z`
  })()

  return (
    <div>
      {label ? <div className="small text-secondary mb-2">{label}</div> : null}
      <svg viewBox="0 0 100 36" className="w-100" style={{ height: `${safeHeight}px` }} role="img" aria-label={label}>
        <defs>
          <linearGradient id="traffic-area-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.3" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#traffic-area-gradient)" />
        <polyline
          fill="none"
          stroke={stroke}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={pathPoints}
        />
      </svg>
    </div>
  )
}

function SplitTrafficBar({ anonymous = 0, authenticated = 0, total = 0 }) {
  const safeTotal = Math.max(1, Number(total || 0) || Number(anonymous || 0) + Number(authenticated || 0))
  const anonymousWidth = Math.max(6, Math.round((Number(anonymous || 0) / safeTotal) * 100))
  const authenticatedWidth = Math.max(6, Math.round((Number(authenticated || 0) / safeTotal) * 100))

  return (
    <div>
      <div className="d-flex gap-2 align-items-center mb-2 small text-secondary">
        <span>Anonymous</span>
        <span className="ms-auto">Authenticated</span>
      </div>
      <div className="progress" style={{ height: '12px' }}>
        <div className="progress-bar bg-secondary" style={{ width: `${anonymousWidth}%` }} />
        <div className="progress-bar bg-primary" style={{ width: `${authenticatedWidth}%` }} />
      </div>
    </div>
  )
}

function normalizeTrafficDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function getTrafficPageType(event = {}) {
  if (event.isAdminRoute || event.userRole === 'admin') return 'admin'
  if (String(event.contentType || '') === 'blog_post') return 'blog_post'
  return 'page'
}

function getTrafficUserRole(event = {}) {
  if (event.userRole) return String(event.userRole)
  if (event.isAdminRoute) return 'admin'
  if (event.userId) return 'authenticated'
  return 'anonymous'
}

function isTrafficEventInRange(event = {}, startDate = '', endDate = '') {
  const eventTime = new Date(event.createdAt || '').getTime()
  if (!Number.isFinite(eventTime)) return false

  if (startDate) {
    const startTime = new Date(`${startDate}T00:00:00`).getTime()
    if (Number.isFinite(startTime) && eventTime < startTime) return false
  }

  if (endDate) {
    const endTime = new Date(`${endDate}T23:59:59.999`).getTime()
    if (Number.isFinite(endTime) && eventTime > endTime) return false
  }

  return true
}

function countByKey(items = [], keySelector = (item) => item) {
  const counts = new Map()
  items.forEach((item) => {
    const key = String(keySelector(item) || '').trim()
    if (!key) return
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  return [...counts.entries()].sort((left, right) => Number(right[1] || 0) - Number(left[1] || 0))
}

export function TrafficAnalyticsPanel({ analytics = null, filters = {}, onFiltersChange = () => {} }) {
  const traffic = analytics?.traffic || {}
  if (traffic.available === false) {
    return (
      <div className="surface surface-strong surface-pad mt-4">
        <div className="section-kicker mb-2">Traffic</div>
        <div className="h5 mb-1">Traffic analytics unavailable</div>
        <p className="mb-0 text-secondary">
          Traffic tracking requires database storage. Connect MongoDB to capture pageviews and view the breakdown here.
        </p>
      </div>
    )
  }

  const events = Array.isArray(traffic.events) ? traffic.events : []
  const pageBreakdown = Array.isArray(traffic.pageBreakdown) ? traffic.pageBreakdown : []
  const startDate = String(filters.startDate || '')
  const endDate = String(filters.endDate || '')
  const pageType = String(filters.pageType || 'all')
  const userRole = String(filters.userRole || 'all')

  const filteredEvents = events.filter((event) => {
    if (!isTrafficEventInRange(event, startDate, endDate)) return false
    if (pageType !== 'all' && getTrafficPageType(event) !== pageType) return false
    if (userRole !== 'all' && getTrafficUserRole(event) !== userRole) return false
    return true
  })

  const filteredUniqueVisitors = new Set(
    filteredEvents.map((event) => String(event.userId || event.visitorId || '').trim()).filter(Boolean),
  ).size
  const anonymousEvents = filteredEvents.filter((event) => getTrafficUserRole(event) === 'anonymous')
  const authenticatedEvents = filteredEvents.filter((event) => getTrafficUserRole(event) === 'authenticated')
  const adminEvents = filteredEvents.filter((event) => getTrafficUserRole(event) === 'admin')

  const dailySeries = filteredEvents.reduce((map, event) => {
    const key = normalizeTrafficDate(event.createdAt)
    if (!key) return map
    map.set(key, (map.get(key) || 0) + 1)
    return map
  }, new Map())

  const sortedDailySeries = [...dailySeries.entries()].sort((left, right) => String(left[0]).localeCompare(String(right[0])))
  const topPages = countByKey(
    filteredEvents,
    (event) => `${event.path || '/'}|${event.pageTitle || ''}`,
  )
    .slice(0, 8)
    .map(([key, count]) => {
      const [path, title] = key.split('|')
      const pageEvents = filteredEvents.filter((event) => `${event.path || '/'}|${event.pageTitle || ''}` === key)
      const uniqueVisitors = new Set(pageEvents.map((event) => String(event.userId || event.visitorId || '').trim()).filter(Boolean)).size
      const anonymousViews = pageEvents.filter((event) => getTrafficUserRole(event) === 'anonymous').length
      const authenticatedViews = pageEvents.filter((event) => getTrafficUserRole(event) !== 'anonymous').length
      return {
        path,
        title: title || path || 'Page',
        count,
        uniqueVisitors,
        anonymousViews,
        authenticatedViews,
      }
    })

  const topBlogPosts = countByKey(
    filteredEvents.filter((event) => getTrafficPageType(event) === 'blog_post'),
    (event) => event.contentId || event.path,
  )
    .slice(0, 8)
    .map(([postId, count]) => {
      const postEvents = filteredEvents.filter((event) => (event.contentId || event.path) === postId && getTrafficPageType(event) === 'blog_post')
      const uniqueVisitors = new Set(postEvents.map((event) => String(event.userId || event.visitorId || '').trim()).filter(Boolean)).size
      return {
        postId,
        title: postEvents[0]?.pageTitle || postId || 'Blog post',
        path: postEvents[0]?.path || `/blog/${postId}`,
        count,
        uniqueVisitors,
        anonymousViews: postEvents.filter((event) => getTrafficUserRole(event) === 'anonymous').length,
        authenticatedViews: postEvents.filter((event) => getTrafficUserRole(event) !== 'anonymous').length,
      }
    })

  const topUsers = countByKey(
    filteredEvents.filter((event) => getTrafficUserRole(event) !== 'anonymous'),
    (event) => event.userId || event.userEmail || event.visitorId,
  )
    .slice(0, 8)
    .map(([userKey, count]) => {
      const userEvents = filteredEvents.filter(
        (event) => getTrafficUserRole(event) !== 'anonymous' && (event.userId || event.userEmail || event.visitorId) === userKey,
      )
      return {
        userId: userKey,
        userName: userEvents[0]?.userName || userKey || 'User',
        userEmail: userEvents[0]?.userEmail || '',
        count,
        uniqueVisitors: new Set(userEvents.map((event) => String(event.visitorId || event.userId || '').trim()).filter(Boolean)).size,
      }
    })

  const topReferrers = countByKey(filteredEvents, (event) => event.referrer || 'direct').slice(0, 8)
  const pageTypeCounts = {
    page: filteredEvents.filter((event) => getTrafficPageType(event) === 'page').length,
    blog_post: filteredEvents.filter((event) => getTrafficPageType(event) === 'blog_post').length,
    admin: filteredEvents.filter((event) => getTrafficPageType(event) === 'admin').length,
  }
  const displayedPageBreakdown = pageBreakdown.slice(0, 50)

  const resetFilters = () => {
    onFiltersChange({
      startDate: '',
      endDate: '',
      pageType: 'all',
      userRole: 'all',
    })
  }

  const updateFilter = (key, value) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    })
  }

  const trafficWindow = Math.max(
    1,
    ...sortedDailySeries.map(([, count]) => Number(count || 0)),
    ...topPages.map((item) => Number(item.count || 0)),
    ...topBlogPosts.map((item) => Number(item.count || 0)),
    ...topUsers.map((item) => Number(item.count || 0)),
  )

  return (
    <div className="surface surface-strong surface-pad mt-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <div className="section-kicker mb-2">Traffic</div>
          <div className="h5 mb-1">Page views, visitors, and user roles</div>
          <p className="mb-0 text-secondary">
            Filter the latest tracked pageviews by date range, page type, and visitor role.
          </p>
        </div>
        <button type="button" className="btn btn-outline-light btn-sm rounded-pill px-3" onClick={resetFilters}>
          Reset filters
        </button>
      </div>

      <div className="row g-3 mt-3">
        <div className="col-md-3">
          <label className="form-label small text-secondary">Start date</label>
          <input
            type="date"
            className="form-control"
            value={startDate}
            onChange={(event) => updateFilter('startDate', event.target.value)}
          />
        </div>
        <div className="col-md-3">
          <label className="form-label small text-secondary">End date</label>
          <input
            type="date"
            className="form-control"
            value={endDate}
            onChange={(event) => updateFilter('endDate', event.target.value)}
          />
        </div>
        <div className="col-md-3">
          <label className="form-label small text-secondary">Page type</label>
          <select
            className="form-select"
            value={pageType}
            onChange={(event) => updateFilter('pageType', event.target.value)}
          >
            <option value="all">All pages</option>
            <option value="page">Pages</option>
            <option value="blog_post">Blog posts</option>
            <option value="admin">Admin pages</option>
          </select>
        </div>
        <div className="col-md-3">
          <label className="form-label small text-secondary">User role</label>
          <select
            className="form-select"
            value={userRole}
            onChange={(event) => updateFilter('userRole', event.target.value)}
          >
            <option value="all">All visitors</option>
            <option value="anonymous">Anonymous</option>
            <option value="authenticated">Signed in</option>
            <option value="admin">Admins</option>
          </select>
        </div>
      </div>

      <div className="row g-3 mt-3">
        <div className="col-6 col-lg-3">
          <div className="surface surface-soft surface-pad h-100">
            <div className="small text-secondary">Filtered views</div>
            <div className="h4 mb-0">{filteredEvents.length}</div>
            <div className="small text-secondary mt-1">Within the selected filters</div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="surface surface-soft surface-pad h-100">
            <div className="small text-secondary">Unique visitors</div>
            <div className="h4 mb-0">{filteredUniqueVisitors}</div>
            <div className="small text-secondary mt-1">Session or account-based</div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="surface surface-soft surface-pad h-100">
            <div className="small text-secondary">Anonymous views</div>
            <div className="h4 mb-0">{anonymousEvents.length}</div>
            <div className="small text-secondary mt-1">Visitor ID only</div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="surface surface-soft surface-pad h-100">
            <div className="small text-secondary">Signed-in views</div>
            <div className="h4 mb-0">{authenticatedEvents.length}</div>
            <div className="small text-secondary mt-1">{adminEvents.length} admin-route views</div>
          </div>
        </div>
      </div>

      <div className="row g-3 mt-3">
        <div className="col-lg-8">
          <div className="surface surface-soft surface-pad h-100">
            <div className="section-kicker mb-2">Traffic trend</div>
            <LineChart
              series={sortedDailySeries.map(([, count]) => Number(count || 0))}
              height={220}
              label="Views per day in the selected range."
            />
            <div className="d-flex flex-wrap gap-3 small text-secondary mt-3">
              <span>{formatMetricCount(filteredEvents.length)} views</span>
              <span>{formatMetricCount(filteredUniqueVisitors)} visitors</span>
              <span>{formatMetricCount(anonymousEvents.length)} anonymous</span>
              <span>{formatMetricCount(authenticatedEvents.length)} signed in</span>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="surface surface-soft surface-pad h-100">
            <div className="section-kicker mb-2">Page type split</div>
            <div className="d-grid gap-3">
              <div className="d-flex justify-content-between small">
                <span className="text-secondary">Pages</span>
                <strong>{formatMetricCount(pageTypeCounts.page)}</strong>
              </div>
              <div className="d-flex justify-content-between small">
                <span className="text-secondary">Blog posts</span>
                <strong>{formatMetricCount(pageTypeCounts.blog_post)}</strong>
              </div>
              <div className="d-flex justify-content-between small">
                <span className="text-secondary">Admin pages</span>
                <strong>{formatMetricCount(pageTypeCounts.admin)}</strong>
              </div>
              <SplitTrafficBar
                anonymous={anonymousEvents.length}
                authenticated={authenticatedEvents.length}
                total={filteredEvents.length}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mt-3">
        <div className="col-lg-6">
          <div className="surface surface-soft surface-pad h-100">
            <div className="section-kicker mb-2">Popular pages</div>
            <div className="d-grid gap-3">
              {topPages.length ? (
                topPages.map((item) => {
                  const width = Math.max(8, Math.round((Number(item.count || 0) / trafficWindow) * 100))
                  return (
                    <div key={item.path || item.title}>
                      <div className="d-flex justify-content-between align-items-start gap-3 mb-1">
                        <div>
                          <div className="fw-semibold text-break">{item.title || item.path || 'Page'}</div>
                          <div className="small text-secondary text-break">{item.path || '/'}</div>
                        </div>
                        <div className="small text-secondary text-end">
                          <div>{item.count || 0} views</div>
                          <div>{item.uniqueVisitors || 0} visitors</div>
                          <div>{item.anonymousViews || 0} anon · {item.authenticatedViews || 0} signed in</div>
                        </div>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div className="progress-bar bg-primary" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="small text-secondary">No page views in this filter set.</div>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="surface surface-soft surface-pad h-100">
            <div className="section-kicker mb-2">Popular blog posts</div>
            <div className="d-grid gap-3">
              {topBlogPosts.length ? (
                topBlogPosts.map((item) => {
                  const width = Math.max(8, Math.round((Number(item.count || 0) / trafficWindow) * 100))
                  return (
                    <div key={item.postId || item.path || item.title}>
                      <div className="d-flex justify-content-between align-items-start gap-3 mb-1">
                        <div>
                          <NavLink className="fw-semibold text-break d-block" to={item.path || `/blog/${item.postId}`}>
                            {item.title || item.postId || 'Blog post'}
                          </NavLink>
                          <div className="small text-secondary text-break">{item.path || `/blog/${item.postId || ''}`}</div>
                        </div>
                        <div className="small text-secondary text-end">
                          <div>{item.count || 0} views</div>
                          <div>{item.uniqueVisitors || 0} visitors</div>
                          <div>{item.anonymousViews || 0} anon · {item.authenticatedViews || 0} signed in</div>
                        </div>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div className="progress-bar bg-info" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="small text-secondary">No blog post views in this filter set.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mt-3">
        <div className="col-lg-7">
          <div className="surface surface-soft surface-pad h-100">
            <div className="section-kicker mb-2">Top signed-in users</div>
            <div className="d-grid gap-3">
              {topUsers.length ? (
                topUsers.map((item) => {
                  const width = Math.max(8, Math.round((Number(item.count || 0) / trafficWindow) * 100))
                  return (
                    <div key={item.userId || item.userName}>
                      <div className="d-flex justify-content-between align-items-start gap-3 mb-1">
                        <div>
                          <div className="fw-semibold text-break">{item.userName || 'User'}</div>
                          <div className="small text-secondary text-break">{item.userEmail || item.userId || 'Signed-in visitor'}</div>
                        </div>
                        <div className="small text-secondary text-end">
                          <div>{item.count || 0} views</div>
                          <div>{item.uniqueVisitors || 0} sessions</div>
                        </div>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div className="progress-bar bg-primary" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="small text-secondary">No signed-in traffic in this filter set.</div>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="surface surface-soft surface-pad h-100">
            <div className="section-kicker mb-2">Top referrers</div>
            <div className="d-grid gap-3">
              {topReferrers.length ? (
                topReferrers.map(([referrer, count]) => {
                  const width = Math.max(8, Math.round((Number(count || 0) / trafficWindow) * 100))
                  return (
                    <div key={referrer}>
                      <div className="d-flex justify-content-between align-items-center gap-3 mb-1">
                        <div className="fw-semibold text-break">{referrer || 'direct'}</div>
                        <div className="small text-secondary">{count}</div>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div className="progress-bar bg-success" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="small text-secondary">No referrer data in this filter set.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="surface surface-soft surface-pad mt-3">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
          <div>
            <div className="section-kicker mb-2">Per-page breakdown</div>
            <div className="small text-secondary">
              Views grouped by route so you can inspect each page separately.
            </div>
          </div>
          <div className="small text-secondary">
            Showing {formatMetricCount(displayedPageBreakdown.length)} of {formatMetricCount(pageBreakdown.length)} pages
          </div>
        </div>
        {displayedPageBreakdown.length ? (
          <div className="table-responsive" style={{ maxHeight: '420px', overflowY: 'auto' }}>
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col">Page</th>
                  <th scope="col" className="text-end">Views</th>
                  <th scope="col" className="text-end">Unique</th>
                  <th scope="col" className="text-end">Anon</th>
                  <th scope="col" className="text-end">Signed in</th>
                  <th scope="col">Last viewed</th>
                </tr>
              </thead>
              <tbody>
                {displayedPageBreakdown.map((item) => (
                  <tr key={item.path || item.title}>
                    <td className="text-break">
                      <div className="fw-semibold text-break">{item.title || item.path || 'Page'}</div>
                      <div className="small text-secondary text-break">{item.path || '/'}</div>
                    </td>
                    <td className="text-end">{item.count || 0}</td>
                    <td className="text-end">{item.uniqueVisitors || 0}</td>
                    <td className="text-end">{item.anonymousViews || 0}</td>
                    <td className="text-end">{item.authenticatedViews || 0}</td>
                    <td className="text-nowrap">{item.lastViewedAt ? formatDateTime(item.lastViewedAt) : 'Unknown'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="small text-secondary">No page-level traffic has been recorded yet.</div>
        )}
      </div>

      <div className="surface surface-soft surface-pad mt-3">
        <div className="section-kicker mb-2">Recent filtered events</div>
        <div className="timeline-list">
          {filteredEvents.length ? (
            filteredEvents.slice(0, 15).map((event) => (
              <article className="timeline-item" key={event.id || `${event.createdAt}-${event.path}`}>
                <time>{formatDateTime(event.createdAt)}</time>
                <div>
                  <h4 className="h5 mb-1">{event.pageTitle || event.path || 'Page view'}</h4>
                  <p className="mb-1 text-secondary">
                    {event.path || '/'}
                    {event.userName ? ` · ${event.userName}` : ''}
                    {event.userRole ? ` · ${event.userRole}` : ''}
                  </p>
                  <p className="mb-0 small text-secondary">
                    {event.contentType || 'page'}
                    {event.referrer ? ` · referrer: ${event.referrer}` : ''}
                  </p>
                </div>
              </article>
            ))
          ) : (
            <div className="small text-secondary">No traffic events match the selected filters.</div>
          )}
        </div>
      </div>
    </div>
  )
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
  const traffic = analytics?.traffic || {}
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
  const totalPageViews = Number(traffic.pageViews ?? 0)
  const uniqueVisitors = Number(traffic.uniqueVisitors ?? 0)
  const authenticatedPageViews = Number(traffic.authenticatedPageViews ?? 0)
  const anonymousPageViews = Number(traffic.anonymousPageViews ?? 0)
  const authenticatedUniqueVisitors = Number(traffic.authenticatedUniqueVisitors ?? 0)
  const anonymousUniqueVisitors = Number(traffic.anonymousUniqueVisitors ?? 0)
  const anonymousIpFingerprints = Number(traffic.anonymousIpFingerprints ?? 0)
  const trafficUnavailable = traffic.available === false
  const recentPageViews = Number(traffic.recentPageViews ?? 0)
  const recentUniqueVisitors = Number(traffic.recentUniqueVisitors ?? 0)
  const recentAuthenticatedPageViews = Number(traffic.recentAuthenticatedPageViews ?? 0)
  const recentAnonymousPageViews = Number(traffic.recentAnonymousPageViews ?? 0)
  const recentAuthenticatedUniqueVisitors = Number(traffic.recentAuthenticatedUniqueVisitors ?? 0)
  const recentAnonymousUniqueVisitors = Number(traffic.recentAnonymousUniqueVisitors ?? 0)
  const recentAnonymousIpFingerprints = Number(traffic.recentAnonymousIpFingerprints ?? 0)
  const topPages = Array.isArray(traffic.topPages) ? traffic.topPages : []
  const topBlogPosts = Array.isArray(traffic.topBlogPosts) ? traffic.topBlogPosts : []
  const topReferrers = Array.isArray(traffic.topReferrers) ? traffic.topReferrers : []
  const topUsers = Array.isArray(traffic.topUsers) ? traffic.topUsers : []
  const dailyViews = Array.isArray(traffic.dailyViews) ? traffic.dailyViews : []
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
  const trafficWindow = Math.max(
    1,
    ...dailyViews.map((item) => Number(item.count || 0)),
    ...topPages.map((item) => Number(item.count || 0)),
    ...topBlogPosts.map((item) => Number(item.count || 0)),
    ...topUsers.map((item) => Number(item.count || 0)),
  )

  return (
    <div className="surface surface-pad mt-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <div className="section-kicker mb-2">Analytics</div>
          <div className="h5 mb-1">Live site activity</div>
          <p className="mb-0 text-secondary">
            Real counts from requests, inbox traffic, page views, RSVPs, blog posts, and community events.
          </p>
          {trafficUnavailable ? (
            <div className="alert alert-warning mt-3 mb-0 py-2 px-3 small">
              Traffic analytics require database storage and are unavailable until MongoDB is connected.
            </div>
          ) : null}
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

      <div className="row g-3 mt-3">
        <div className="col-lg-8">
          <div className="surface surface-soft surface-pad h-100">
            <div className="section-kicker mb-2">Traffic trend</div>
            <LineChart
              series={dailyViews.map((item) => Number(item.count || 0))}
              height={220}
              label="Daily page views for the last 30 days."
            />
            <div className="d-flex flex-wrap gap-3 small text-secondary mt-3">
              <span>{formatMetricCount(totalPageViews)} total views</span>
              <span>{formatMetricCount(recentPageViews)} in 30 days</span>
              <span>{formatMetricCount(recentUniqueVisitors)} recent visitors</span>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="surface surface-soft surface-pad h-100">
            <div className="section-kicker mb-2">Anonymous vs signed-in</div>
            <div className="d-grid gap-3">
              <div className="d-flex justify-content-between gap-3 small">
                <span className="text-secondary">Anonymous views</span>
                <strong>{formatMetricCount(anonymousPageViews)}</strong>
              </div>
              <div className="d-flex justify-content-between gap-3 small">
                <span className="text-secondary">Signed-in views</span>
                <strong>{formatMetricCount(authenticatedPageViews)}</strong>
              </div>
              <SplitTrafficBar
                anonymous={anonymousPageViews}
                authenticated={authenticatedPageViews}
                total={totalPageViews}
              />
              <div className="d-flex justify-content-between gap-3 small">
                <span className="text-secondary">Anonymous visitors</span>
                <strong>{formatMetricCount(anonymousUniqueVisitors)}</strong>
              </div>
              <div className="d-flex justify-content-between gap-3 small">
                <span className="text-secondary">Anonymous IP fingerprints</span>
                <strong>{formatMetricCount(anonymousIpFingerprints)}</strong>
              </div>
              <div className="d-flex justify-content-between gap-3 small">
                <span className="text-secondary">Signed-in visitors</span>
                <strong>{formatMetricCount(authenticatedUniqueVisitors)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mt-3">
        <div className="col-6 col-lg-3">
          <div className="surface surface-soft surface-pad h-100">
            <div className="small text-secondary">Page views</div>
            <div className="h4 mb-0">{totalPageViews}</div>
            <div className="small text-secondary mt-1">{recentPageViews} in 30 days</div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="surface surface-soft surface-pad h-100">
            <div className="small text-secondary">Unique visitors</div>
            <div className="h4 mb-0">{uniqueVisitors}</div>
            <div className="small text-secondary mt-1">{recentUniqueVisitors} in 30 days</div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="surface surface-soft surface-pad h-100">
            <div className="small text-secondary">Anonymous visits</div>
            <div className="h4 mb-0">{anonymousPageViews}</div>
            <div className="small text-secondary mt-1">
              {recentAnonymousPageViews} in 30 days · {recentAnonymousIpFingerprints} IP fingerprints
            </div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="surface surface-soft surface-pad h-100">
            <div className="small text-secondary">Signed-in visits</div>
            <div className="h4 mb-0">{authenticatedPageViews}</div>
            <div className="small text-secondary mt-1">{recentAuthenticatedPageViews} in 30 days</div>
          </div>
        </div>
      </div>

      <div className="row g-3 mt-3">
        <div className="col-lg-6">
          <div className="surface surface-soft surface-pad h-100">
            <div className="section-kicker mb-2">Popular pages</div>
            <div className="d-grid gap-3">
              {topPages.length ? (
                topPages.map((item) => {
                  const width = Math.max(8, Math.round((Number(item.count || 0) / trafficWindow) * 100))
                  return (
                    <div key={item.path || item.title}>
                      <div className="d-flex justify-content-between align-items-start gap-3 mb-1">
                        <div>
                          <div className="fw-semibold text-break">{item.title || item.path || 'Page'}</div>
                          <div className="small text-secondary text-break">{item.path || '/'}</div>
                        </div>
                        <div className="small text-secondary text-end">
                          <div>{item.count || 0} views</div>
                          <div>{item.uniqueVisitors || 0} visitors</div>
                          <div>{item.anonymousViews || 0} anon · {item.authenticatedViews || 0} signed in</div>
                        </div>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div className="progress-bar bg-primary" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="small text-secondary">No page views recorded yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="surface surface-soft surface-pad h-100">
            <div className="section-kicker mb-2">Popular blog posts</div>
            <div className="d-grid gap-3">
              {topBlogPosts.length ? (
                topBlogPosts.map((item) => {
                  const width = Math.max(8, Math.round((Number(item.count || 0) / trafficWindow) * 100))
                  return (
                    <div key={item.postId || item.path || item.title}>
                      <div className="d-flex justify-content-between align-items-start gap-3 mb-1">
                        <div>
                          <NavLink className="fw-semibold text-break d-block" to={item.path || `/blog/${item.postId}`}>
                            {item.title || item.postId || 'Blog post'}
                          </NavLink>
                          <div className="small text-secondary text-break">{item.path || `/blog/${item.postId || ''}`}</div>
                        </div>
                        <div className="small text-secondary text-end">
                          <div>{item.count || 0} views</div>
                          <div>{item.uniqueVisitors || 0} visitors</div>
                          <div>{item.anonymousViews || 0} anon · {item.authenticatedViews || 0} signed in</div>
                        </div>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div className="progress-bar bg-info" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="small text-secondary">No blog post views recorded yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mt-3">
        <div className="col-lg-7">
          <div className="surface surface-soft surface-pad h-100">
            <div className="section-kicker mb-2">Top signed-in users</div>
            <div className="d-grid gap-3">
              {topUsers.length ? (
                topUsers.map((item) => {
                  const width = Math.max(8, Math.round((Number(item.count || 0) / trafficWindow) * 100))
                  return (
                    <div key={item.userId || item.userName}>
                      <div className="d-flex justify-content-between align-items-start gap-3 mb-1">
                        <div>
                          <div className="fw-semibold text-break">{item.userName || 'User'}</div>
                          <div className="small text-secondary text-break">
                            {item.userEmail || item.userId || 'Signed-in traffic'}
                          </div>
                        </div>
                        <div className="small text-secondary text-end">
                          <div>{item.count || 0} views</div>
                          <div>{item.uniqueVisitors || 0} sessions</div>
                        </div>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div className="progress-bar bg-primary" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="small text-secondary">No signed-in traffic yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="surface surface-soft surface-pad h-100">
            <div className="section-kicker mb-2">Top referrers</div>
            <div className="d-grid gap-3">
              {topReferrers.length ? (
                topReferrers.map((item) => {
                  const width = Math.max(8, Math.round((Number(item.count || 0) / trafficWindow) * 100))
                  return (
                    <div key={item.referrer}>
                      <div className="d-flex justify-content-between align-items-center gap-3 mb-1">
                        <div className="fw-semibold text-break">{item.referrer || 'direct'}</div>
                        <div className="small text-secondary">{item.count || 0}</div>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div className="progress-bar bg-success" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="small text-secondary">No referrer data yet.</div>
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
