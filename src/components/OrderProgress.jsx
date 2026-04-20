import { getOrderProgressSteps } from '../lib/orderStatus.js'

export function OrderProgress({ order = {}, compact = false }) {
  const steps = getOrderProgressSteps(order)

  return (
    <div className={compact ? 'order-progress order-progress-compact' : 'order-progress'}>
      {steps.map((step, index) => (
        <div className={`order-progress-step is-${step.state}`} key={step.key}>
          <div className="order-progress-marker" aria-hidden="true">
            <span>{index + 1}</span>
          </div>
          <div className="order-progress-copy">
            <div className="order-progress-label">{step.label}</div>
            <div className="order-progress-detail">{step.detail}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
