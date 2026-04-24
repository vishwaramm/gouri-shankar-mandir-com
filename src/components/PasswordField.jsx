import { useId, useState } from 'react'

function EyeIcon({ hidden = false }) {
  if (hidden) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M4 4l16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M9.4 9.5A3.5 3.5 0 0114.5 14.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M10.8 5.4c.4-.1.8-.1 1.2-.1 4.9 0 8.8 3.1 10.4 7.2-.6 1.7-1.5 3.2-2.7 4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7.3 7.3C4.9 8.8 3.2 10.9 2 12.5c1.8 2.7 5.8 7 10 7 1 0 1.9-.1 2.8-.3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M2.5 12s3.7-6.5 9.5-6.5S21.5 12 21.5 12s-3.7 6.5-9.5 6.5S2.5 12 2.5 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  name,
  id,
  disabled = false,
  required = false,
  helpText = '',
  className = '',
}) {
  const generatedId = useId()
  const inputId = id || generatedId
  const [visible, setVisible] = useState(false)

  return (
    <div className={className}>
      <label className="form-label fw-semibold" htmlFor={inputId}>
        {label}
      </label>
      <div className="input-group password-field">
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          className="form-control"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          name={name}
          disabled={disabled}
          required={required}
        />
        <button
          type="button"
          className="btn btn-outline-secondary password-toggle"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          disabled={disabled}
        >
          <EyeIcon hidden={!visible} />
        </button>
      </div>
      {helpText ? <p className="form-text text-secondary mb-0">{helpText}</p> : null}
    </div>
  )
}

export default PasswordField
