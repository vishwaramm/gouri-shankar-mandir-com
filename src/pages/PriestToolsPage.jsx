import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  loadPriestAuthStatus,
  loadSiteData,
  markServiceRequestCompleted,
  processServiceCancellation,
  processServiceRefund,
  syncSquareOrders,
} from '../lib/siteApi.js'
import {
  AdminAccessRequestsPanel,
  OrderEventLogPanel,
  SquareSyncPanel,
  ServiceRequestCard,
  SupportRequestCard,
} from '../components/PriestToolsSections.jsx'

function PriestToolsPage() {
  const navigate = useNavigate()
  const [auth, setAuth] = useState({
    loading: true,
    authenticated: false,
  })
  const [requests, setRequests] = useState([])
  const [syncStatus, setSyncStatus] = useState({
    webhookConfigured: false,
    signatureConfigured: false,
    webhookUrl: '',
    recentEvents: 0,
    lastEventAt: '',
    lastEventType: '',
  })
  const [recentEvents, setRecentEvents] = useState([])
  const [adminAccessRequests, setAdminAccessRequests] = useState([])
  const [adminPermissions, setAdminPermissions] = useState({
    role: 'staff',
    canViewAdminAccessRequests: false,
    canViewSquareSync: false,
    canResetSiteData: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [completionStatusById, setCompletionStatusById] = useState({})
  const [completionBusyById, setCompletionBusyById] = useState({})
  const [cancellationStatusById, setCancellationStatusById] = useState({})
  const [cancellationBusyById, setCancellationBusyById] = useState({})
  const [refundStatusById, setRefundStatusById] = useState({})
  const [refundBusyById, setRefundBusyById] = useState({})
  const [syncBusy, setSyncBusy] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [orderSyncBusyById, setOrderSyncBusyById] = useState({})
  const [orderSyncStatusById, setOrderSyncStatusById] = useState({})

  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  }, [requests])
  const supportRequests = useMemo(() => {
    return sortedRequests.filter((item) => ['cancel_requested', 'refund_requested'].includes(item.serviceStatus))
  }, [sortedRequests])
  const sentCount = sortedRequests.filter((item) => item.paymentPageSentAt).length
  const paidCount = sortedRequests.filter((item) => item.paymentReceivedAt).length
  const completedCount = sortedRequests.filter((item) => item.serviceCompletedAt).length
  const refundCount = sortedRequests.filter((item) => item.refundedAt).length
  const cancelledCount = sortedRequests.filter((item) => item.cancelledAt).length
  const supportCount = supportRequests.length

  const getSupportLabel = (request) => {
    if (request.serviceStatus === 'refund_requested') return 'Refund requested'
    if (request.serviceStatus === 'cancel_requested') return 'Cancellation requested'
    return 'Support requested'
  }

  const refreshAuth = useCallback(async () => {
    const status = await loadPriestAuthStatus()
    setAuth({
      loading: false,
      authenticated: Boolean(status.authenticated),
    })
    return status
  }, [])

  const refreshRequests = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const data = await loadSiteData()
      setRequests(Array.isArray(data.orders) ? data.orders : [])
      setRecentEvents(Array.isArray(data.orderEvents) ? data.orderEvents : [])
      setAdminAccessRequests(Array.isArray(data.adminAccessRequests) ? data.adminAccessRequests : [])
      setAdminPermissions(
        data.adminPermissions || {
          role: 'staff',
          canViewAdminAccessRequests: false,
          canViewSquareSync: false,
          canResetSiteData: false,
        },
      )
      setSyncStatus(
        data.squareSyncStatus || {
          webhookConfigured: false,
          signatureConfigured: false,
          webhookUrl: '',
          recentEvents: 0,
          lastEventAt: '',
          lastEventType: '',
        },
      )
    } catch (fetchError) {
      const message = fetchError?.message || 'Unable to load service requests.'
      setError(message)
      if (/unauthorized|not configured/i.test(message)) {
        setAuth((current) => ({ ...current, authenticated: false }))
        navigate('/priest-review', { replace: true })
      }
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    refreshAuth()
      .then((status) => {
        if (status.authenticated) {
          refreshRequests()
        } else {
          navigate('/priest-review', { replace: true })
        }
      })
      .catch(() => {
        setAuth({ loading: false, authenticated: false })
        navigate('/priest-review', { replace: true })
      })
  }, [navigate, refreshAuth, refreshRequests])

  const handleMarkComplete = async (request) => {
    if (!request.id) return

    setCompletionBusyById((current) => ({ ...current, [request.id]: true }))
    setCompletionStatusById((current) => ({ ...current, [request.id]: 'Marking complete...' }))

    try {
      const result = await markServiceRequestCompleted({
        requestId: request.id,
      })

      setRequests((current) =>
        current.map((item) =>
          item.id === request.id
            ? {
                ...item,
                serviceStatus: result.entry?.serviceStatus || 'completed',
                serviceCompletedAt: result.entry?.serviceCompletedAt || '',
                serviceCompletionNotifiedAt: result.entry?.serviceCompletionNotifiedAt || '',
                completionNote: result.entry?.completionNote || '',
              }
            : item,
        ),
      )
      setCompletionStatusById((current) => ({
        ...current,
        [request.id]: result.completionEmailSent
          ? 'Service marked complete. Completion email sent.'
          : 'Service marked complete. Completion email was not sent automatically.',
      }))
    } catch (completeError) {
      setCompletionStatusById((current) => ({
        ...current,
        [request.id]: completeError?.message || 'Unable to mark complete.',
      }))
    } finally {
      setCompletionBusyById((current) => ({ ...current, [request.id]: false }))
    }
  }

  const handleProcessRefund = async (request) => {
    if (!request.id) return

    setRefundBusyById((current) => ({ ...current, [request.id]: true }))
    setRefundStatusById((current) => ({ ...current, [request.id]: 'Processing refund...' }))

    try {
      const result = await processServiceRefund({
        requestId: request.id,
        reason: request.supportRequestReason || request.completionNote || 'Service refund',
      })

      setRequests((current) =>
        current.map((item) =>
          item.id === request.id
            ? {
                ...item,
                serviceStatus: result.entry?.serviceStatus || 'refunded',
                refundRequestedAt: result.entry?.refundRequestedAt || item.refundRequestedAt || '',
                refundedAt: result.entry?.refundedAt || '',
                refundStatus: result.entry?.refundStatus || '',
                refundSquareRefundId: result.entry?.refundSquareRefundId || '',
              }
            : item,
        ),
      )
      setRefundStatusById((current) => ({
        ...current,
        [request.id]: result.refundEmailSent
          ? 'Refund processed. Refund email sent.'
          : 'Refund processed. Refund email was not sent automatically.',
      }))
      setCompletionStatusById((current) => ({
        ...current,
        [request.id]: '',
      }))
    } catch (refundError) {
      setRefundStatusById((current) => ({
        ...current,
        [request.id]: refundError?.message || 'Unable to process refund.',
      }))
    } finally {
      setRefundBusyById((current) => ({ ...current, [request.id]: false }))
    }
  }

  const handleProcessCancellation = async (request) => {
    if (!request.id) return

    setCancellationBusyById((current) => ({ ...current, [request.id]: true }))
    setCancellationStatusById((current) => ({ ...current, [request.id]: 'Resolving cancellation...' }))

    try {
      const result = await processServiceCancellation({
        requestId: request.id,
        reason: request.supportRequestReason || request.completionNote || 'Service cancellation',
      })

      setRequests((current) =>
        current.map((item) =>
          item.id === request.id
            ? {
                ...item,
                serviceStatus: result.entry?.serviceStatus || 'cancelled',
                cancelledAt: result.entry?.cancelledAt || '',
                supportRequestType: result.entry?.supportRequestType || 'cancel',
                supportRequestedAt: result.entry?.supportRequestedAt || item.supportRequestedAt || '',
                supportRequestReason: result.entry?.supportRequestReason || item.supportRequestReason || '',
              }
            : item,
        ),
      )
      setCancellationStatusById((current) => ({
        ...current,
        [request.id]: result.cancellationEmailSent
          ? 'Cancellation resolved. Email sent.'
          : 'Cancellation resolved. Email was not sent automatically.',
      }))
      setRefundStatusById((current) => ({
        ...current,
        [request.id]: '',
      }))
    } catch (cancellationError) {
      setCancellationStatusById((current) => ({
        ...current,
        [request.id]: cancellationError?.message || 'Unable to resolve cancellation.',
      }))
    } finally {
      setCancellationBusyById((current) => ({ ...current, [request.id]: false }))
    }
  }

  const handleSyncSquare = async () => {
    setSyncBusy(true)
    setSyncMessage('Syncing Square records...')

    try {
      const result = await syncSquareOrders()
      setSyncMessage(result.message || 'Square sync complete.')

      const data = await loadSiteData()
      setRequests(Array.isArray(data.orders) ? data.orders : [])
      setRecentEvents(Array.isArray(data.orderEvents) ? data.orderEvents : [])
      setAdminAccessRequests(Array.isArray(data.adminAccessRequests) ? data.adminAccessRequests : [])
      setAdminPermissions(
        data.adminPermissions || {
          role: 'staff',
          canViewAdminAccessRequests: false,
          canViewSquareSync: false,
          canResetSiteData: false,
        },
      )
      setSyncStatus(
        data.squareSyncStatus || {
          webhookConfigured: false,
          signatureConfigured: false,
          webhookUrl: '',
          recentEvents: 0,
          lastEventAt: '',
          lastEventType: '',
        },
      )
    } catch (syncError) {
      setSyncMessage(syncError?.message || 'Unable to sync Square records.')
    } finally {
      setSyncBusy(false)
    }
  }

  const handleSyncOrder = async (request) => {
    if (!request?.id) return

    setOrderSyncBusyById((current) => ({ ...current, [request.id]: true }))
    setOrderSyncStatusById((current) => ({ ...current, [request.id]: 'Syncing this order...' }))

    try {
      const result = await syncSquareOrders({
        requestId: request.id,
        orderCode: request.orderCode || '',
      })

      setOrderSyncStatusById((current) => ({
        ...current,
        [request.id]: result.message || 'Order synced.',
      }))

      const data = await loadSiteData()
      setRequests(Array.isArray(data.orders) ? data.orders : [])
      setRecentEvents(Array.isArray(data.orderEvents) ? data.orderEvents : [])
      setAdminAccessRequests(Array.isArray(data.adminAccessRequests) ? data.adminAccessRequests : [])
      setAdminPermissions(
        data.adminPermissions || {
          role: 'staff',
          canViewAdminAccessRequests: false,
          canViewSquareSync: false,
          canResetSiteData: false,
        },
      )
      setSyncStatus(
        data.squareSyncStatus || {
          webhookConfigured: false,
          signatureConfigured: false,
          webhookUrl: '',
          recentEvents: 0,
          lastEventAt: '',
          lastEventType: '',
        },
      )
    } catch (syncError) {
      setOrderSyncStatusById((current) => ({
        ...current,
        [request.id]: syncError?.message || 'Unable to sync this order.',
      }))
    } finally {
      setOrderSyncBusyById((current) => ({ ...current, [request.id]: false }))
    }
  }

  return (
    <main className="priest-tools-page min-vh-100" data-bs-theme="dark">
      <section className="section-block pb-4">
        <div className="container-xxl">
          {auth.loading ? <div className="surface surface-pad">Loading access status...</div> : null}

          {!auth.loading && !auth.authenticated ? (
            <div className="surface surface-strong surface-pad mx-auto" style={{ maxWidth: '42rem' }}>
              <p className="section-kicker mb-3">Locked</p>
              <h1 className="h3 mb-3">Open admin access first</h1>
              <p className="section-intro mb-4">
                The private tools page only opens after an admin account signs in.
              </p>
              <NavLink to="/priest-review" className="btn btn-primary rounded-pill px-4">
                Open admin login
              </NavLink>
            </div>
          ) : null}

          {!auth.loading && auth.authenticated ? (
            <div className="surface surface-strong surface-pad">
              <div className="row g-4 align-items-end">
                <div className="col-lg-8">
                  <p className="section-kicker mb-3">Private admin</p>
                  <h1 className="display-5 mb-3">Dashboard</h1>
                  <p className="section-intro mb-0">
                    Review incoming requests, then open the separate payment request or custom payment page when it is time to send a payment link.
                  </p>
                  <div className="d-flex flex-wrap gap-2 mt-3">
                    <span className="badge text-bg-light border text-dark">
                      Role: {adminPermissions.role === 'owner' ? 'Owner' : 'Staff'}
                    </span>
                    <span className="badge text-bg-light border text-dark">Order audit log enabled</span>
                  </div>
                </div>
                <div className="col-lg-4">
                  <div className="d-grid gap-2">
                    <button type="button" className="btn admin-refresh-btn rounded-pill px-4" onClick={refreshAuth}>
                      Refresh
                    </button>
                  </div>
                </div>
              </div>

              <div className="row g-3 mt-4">
                <div className="col-sm-4">
                  <div className="surface surface-soft surface-pad h-100">
                    <div className="section-kicker mb-2">Requests</div>
                    <div className="display-6 mb-0">{sortedRequests.length}</div>
                  </div>
                </div>
                <div className="col-sm-4">
                  <div className="surface surface-soft surface-pad h-100">
                    <div className="section-kicker mb-2">Sent</div>
                    <div className="display-6 mb-0">{sentCount}</div>
                  </div>
                </div>
                <div className="col-sm-4">
                  <div className="surface surface-soft surface-pad h-100">
                    <div className="section-kicker mb-2">Paid</div>
                    <div className="h4 mb-0">{paidCount}</div>
                  </div>
                </div>
                <div className="col-sm-4">
                  <div className="surface surface-soft surface-pad h-100">
                    <div className="section-kicker mb-2">Completed</div>
                    <div className="h4 mb-0">{completedCount}</div>
                  </div>
                </div>
                <div className="col-sm-4">
                  <div className="surface surface-soft surface-pad h-100">
                    <div className="section-kicker mb-2">Refunded</div>
                    <div className="h4 mb-0">{refundCount}</div>
                  </div>
                </div>
                <div className="col-sm-4">
                  <div className="surface surface-soft surface-pad h-100">
                    <div className="section-kicker mb-2">Support</div>
                    <div className="h4 mb-0">{supportCount}</div>
                  </div>
                </div>
                <div className="col-sm-4">
                  <div className="surface surface-soft surface-pad h-100">
                    <div className="section-kicker mb-2">Cancelled</div>
                    <div className="h4 mb-0">{cancelledCount}</div>
                  </div>
                </div>
              </div>

              {adminPermissions.canViewSquareSync ? (
                <details className="surface surface-soft surface-pad mt-4">
                  <summary className="h6 mb-0 cursor-pointer">Diagnostics</summary>
                  <div className="mt-3">
                    <SquareSyncPanel
                      syncStatus={syncStatus}
                      syncBusy={syncBusy}
                      syncMessage={syncMessage}
                      onSync={handleSyncSquare}
                    />
                  </div>
                </details>
              ) : null}

              {adminPermissions.canViewAdminAccessRequests ? (
                <AdminAccessRequestsPanel requests={adminAccessRequests} />
              ) : null}
              <OrderEventLogPanel events={recentEvents} />
            </div>
          ) : null}
        </div>
      </section>

      {!auth.loading && auth.authenticated ? (
        <section className="pb-5">
          <div className="container-xxl">
            <div className="surface surface-pad mb-4">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                <div>
                  <p className="section-kicker mb-2">Support queue</p>
                  <h2 className="h4 mb-0">Open cancellation and refund requests</h2>
                </div>
                <div className="d-flex flex-wrap gap-2 align-items-center">
                  <span className="badge text-bg-warning text-dark">{supportCount} open</span>
                  <span className="badge text-bg-light border text-dark">{refundCount} refunded</span>
                </div>
              </div>
            </div>

            {supportRequests.length ? (
              <div className="row g-4 mb-4">
                {supportRequests.map((request) => (
                  <SupportRequestCard
                    key={`support-${request.id || `${request.createdAt}-${request.email}`}`}
                    request={request}
                    supportLabel={getSupportLabel(request)}
                    refundBusy={Boolean(refundBusyById[request.id])}
                    cancellationBusy={Boolean(cancellationBusyById[request.id])}
                    refundStatus={refundStatusById[request.id] || ''}
                    cancellationStatus={cancellationStatusById[request.id] || ''}
                    orderSyncBusy={Boolean(orderSyncBusyById[request.id])}
                    orderSyncStatus={orderSyncStatusById[request.id] || ''}
                    onOpenRecord={() => navigate(`/order/${encodeURIComponent(request.orderCode || request.id || '')}`)}
                    onProcessRefund={() => handleProcessRefund(request)}
                    onProcessCancellation={() => handleProcessCancellation(request)}
                    onSyncOrder={() => handleSyncOrder(request)}
                  />
                ))}
              </div>
            ) : (
              <div className="surface surface-pad mb-4">No open support requests.</div>
            )}

            <div className="surface surface-pad mb-4">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                <div>
                  <p className="section-kicker mb-2">Service requests</p>
                  <h2 className="h4 mb-0">Incoming requests</h2>
                </div>
                <div className="d-flex flex-wrap gap-2 align-items-center">
                  <span className="badge text-bg-secondary">{sortedRequests.length} requests</span>
                  <span className="badge text-bg-light border text-dark">{sentCount} sent</span>
                </div>
              </div>
            </div>

            {error ? <div className="alert alert-danger">{error}</div> : null}
            {loading ? <div className="surface surface-pad">Loading requests...</div> : null}

            {!loading && sortedRequests.length === 0 ? (
              <div className="surface surface-pad">No service requests yet.</div>
            ) : null}

            <div className="row g-4 mt-0">
              {sortedRequests.map((request) => (
                  <ServiceRequestCard
                  key={request.id || `${request.createdAt}-${request.email}`}
                  request={request}
                  completionBusy={Boolean(completionBusyById[request.id])}
                  refundBusy={Boolean(refundBusyById[request.id])}
                  completionStatus={completionStatusById[request.id] || ''}
                  refundStatus={refundStatusById[request.id] || ''}
                  orderSyncBusy={Boolean(orderSyncBusyById[request.id])}
                  orderSyncStatus={orderSyncStatusById[request.id] || ''}
                  onMarkComplete={() => handleMarkComplete(request)}
                  onProcessRefund={() => handleProcessRefund(request)}
                  onSyncOrder={() => handleSyncOrder(request)}
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  )
}

export default PriestToolsPage
