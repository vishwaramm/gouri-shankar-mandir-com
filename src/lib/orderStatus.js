export function getOrderStatusLabel(status) {
  switch (status) {
    case 'pending_review':
      return 'Waiting for review'
    case 'awaiting_completion':
      return 'In progress'
    case 'completed':
      return 'Completed'
    case 'refunded':
      return 'Refunded'
    case 'partially_refunded':
      return 'Partially refunded'
    case 'cancelled':
      return 'Cancelled'
    case 'received':
      return 'Received'
    case 'cancel_requested':
      return 'Cancellation requested'
    case 'refund_requested':
      return 'Refund requested'
    default:
      return status ? status.replaceAll('_', ' ') : 'Unknown'
  }
}

export function getOrderNextStep(order = {}) {
  if (order.status === 'refund_requested') {
    return 'A refund request is on file and waiting for review.'
  }
  if (order.status === 'refunded') {
    return 'The payment has been refunded.'
  }
  if (order.refundStatus === 'PARTIALLY_REFUNDED' || order.status === 'partially_refunded') {
    return 'A partial refund has been recorded. The remaining balance and next steps are shown in the order details.'
  }
  if (order.status === 'cancelled') {
    return 'The service has been cancelled.'
  }
  if (order.status === 'cancel_requested') {
    return 'A cancellation request is on file and waiting for review.'
  }
  if (order.status === 'completed') {
    return 'The service has been marked complete.'
  }
  if (order.scheduledFor) {
    return `The service is scheduled for ${formatScheduleDate(order.scheduledFor)}.`
  }
  if (order.status === 'awaiting_completion') {
    return 'Payment is recorded. The priest team will complete the service and send the completion email.'
  }
  if (order.status === 'received') {
    return 'The payment is recorded and ready for follow-up.'
  }
  return 'The priest team will review the request and send the next step by email.'
}

export function getOrderProgressSteps(order = {}) {
  const status = String(order.status || '').toLowerCase()
  const paymentPageSent = Boolean(order.paymentPageSentAt) || ['awaiting_completion', 'completed', 'refunded', 'partially_refunded', 'cancelled'].includes(status)
  const paymentReceived = Boolean(order.paymentReceivedAt) || ['awaiting_completion', 'completed', 'refunded', 'partially_refunded'].includes(status)
  const scheduled = Boolean(order.scheduledFor) || paymentReceived
  const closed = ['completed', 'refunded', 'partially_refunded', 'cancelled'].includes(status)
  const closingLabel =
    status === 'refunded' || status === 'partially_refunded'
      ? 'Refund resolved'
      : status === 'cancelled'
        ? 'Service cancelled'
        : 'Service complete'

  const steps = [
    {
      key: 'request',
      label: 'Request received',
      detail: 'The order is in the priest queue and waiting for review.',
      state: paymentPageSent || paymentReceived || scheduled || closed ? 'complete' : 'active',
    },
    {
      key: 'payment-page',
      label: paymentPageSent ? 'Payment page sent' : 'Review pending',
      detail: paymentPageSent
        ? 'A secure payment link has been sent or is attached to the order.'
        : 'The priest team will review the request and send the payment page next.',
      state: paymentReceived || scheduled || closed ? 'complete' : paymentPageSent ? 'active' : 'pending',
    },
    {
      key: 'payment',
      label: paymentReceived ? 'Payment recorded' : 'Payment pending',
      detail: paymentReceived
        ? scheduled
          ? `Payment is recorded and the target date is ${formatScheduleDate(order.scheduledFor)}.`
          : 'Payment is recorded and the priest team is preparing the service.'
        : 'The donor still needs to complete payment.',
      state: scheduled || closed ? 'complete' : paymentReceived ? 'active' : 'pending',
    },
    {
      key: 'final',
      label: closed ? closingLabel : 'Service in progress',
      detail: closed
        ? 'The order has reached a final status.'
        : scheduled
          ? `The service is scheduled for ${formatScheduleDate(order.scheduledFor)}.`
          : 'The priest team will complete the service after payment is received.',
      state: closed ? 'complete' : scheduled ? 'active' : 'pending',
    },
  ]

  return steps
}

export function isActiveServiceOrder(status) {
  return !['completed', 'refunded', 'cancelled', 'cancel_requested', 'refund_requested'].includes(status)
}

export function getOrderEventLabel(eventType = '') {
  switch (String(eventType || '').toLowerCase()) {
    case 'request_created':
      return 'Request received'
    case 'payment_page_sent':
      return 'Payment page sent'
    case 'payment_received':
      return 'Payment received'
    case 'service_completed':
      return 'Service completed'
    case 'refund_requested':
      return 'Refund requested'
    case 'refund_processed':
      return 'Refund processed'
    case 'cancel_requested':
      return 'Cancellation requested'
    case 'cancelled':
      return 'Cancelled'
    case 'square_payment_update':
      return 'Square payment updated'
    case 'square_refund_update':
      return 'Square refund updated'
    case 'square_sync':
      return 'Square sync'
    default:
      return String(eventType || '').replaceAll('_', ' ') || 'Order update'
  }
}

function formatScheduleDate(value) {
  if (!value) return ''

  const text = String(value).trim()
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T12:00:00`) : new Date(text)
  if (Number.isNaN(date.getTime())) return text

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
