import { useState } from 'react'

function getInitials(name = '') {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (!parts.length) return 'A'
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
}

export function ProfileAvatar({ name = '', photoUrl = '', className = '', size = 48 }) {
  const [loadFailed, setLoadFailed] = useState(false)
  const initials = getInitials(name)
  const style = {
    width: `${size}px`,
    height: `${size}px`,
  }

  if (photoUrl && !loadFailed) {
    return (
      <img
        className={`profile-avatar ${className}`.trim()}
        src={photoUrl}
        alt={name ? `Portrait for ${name}` : 'Profile portrait'}
        style={style}
        onError={() => setLoadFailed(true)}
      />
    )
  }

  return (
    <span className={`profile-avatar profile-avatar-fallback ${className}`.trim()} style={style} aria-hidden="true">
      {initials}
    </span>
  )
}

export default ProfileAvatar
