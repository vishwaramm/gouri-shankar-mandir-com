import { NavLink } from 'react-router-dom'
import { getOrderEventLabel } from '../lib/orderStatus.js'

function formatDateTime(value) {
  if (!value) return 'Unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleString()
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
