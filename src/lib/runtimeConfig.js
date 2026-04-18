let cachedRuntimeConfig = null

async function readRuntimeConfig() {
  if (cachedRuntimeConfig) return cachedRuntimeConfig

  try {
    const response = await fetch('/api/runtime-config', {
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      cachedRuntimeConfig = {}
      return cachedRuntimeConfig
    }

    const data = await response.json()
    cachedRuntimeConfig = data || {}
  } catch {
    cachedRuntimeConfig = {}
  }

  if (typeof window !== 'undefined') {
    window.__SITE_CONFIG__ = cachedRuntimeConfig
  }

  return cachedRuntimeConfig
}

export async function loadRuntimeConfig() {
  return readRuntimeConfig()
}

export function getRuntimeConfig() {
  return cachedRuntimeConfig || (typeof window !== 'undefined' ? window.__SITE_CONFIG__ || {} : {})
}
